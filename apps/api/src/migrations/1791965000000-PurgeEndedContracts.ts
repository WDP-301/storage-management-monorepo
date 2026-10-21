import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Rows that disappear, gathered before anything is deleted so the log matches what was signed off. */
const TEMP_SETS = [
  // Every ENDED contract, soft-deleted ones included, with the unit its booking item points at.
  `CREATE TEMP TABLE "purge_contracts" ON COMMIT DROP AS
     SELECT c."id", c."customer_id", bi."booking_id", bi."storage_unit_id"
       FROM "contracts" c LEFT JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
      WHERE c."status" = 'ENDED'`,
  `CREATE TEMP TABLE "purge_invoices" ON COMMIT DROP AS
     SELECT "id" FROM "invoices" WHERE "contract_id" IN (SELECT "id" FROM "purge_contracts")`,
  // A booking goes only when every one of its items has contracts and all of them are purged: a
  // surviving contract keeps its booking and every item (its deposit formula depends on them),
  // and an item that never got a contract keeps the booking and its deposit transfer.
  `CREATE TEMP TABLE "purge_bookings" ON COMMIT DROP AS
     SELECT DISTINCT pc."booking_id" AS "id" FROM "purge_contracts" pc
      WHERE pc."booking_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "booking_items" o JOIN "contracts" oc ON oc."booking_item_id" = o."id"
           WHERE o."booking_id" = pc."booking_id"
             AND oc."id" NOT IN (SELECT "id" FROM "purge_contracts"))
        AND NOT EXISTS (
          SELECT 1 FROM "booking_items" o
           WHERE o."booking_id" = pc."booking_id"
             AND NOT EXISTS (SELECT 1 FROM "contracts" oc WHERE oc."booking_item_id" = o."id"))`,
  // Every other contract must survive; checked after the deletes.
  `CREATE TEMP TABLE "kept_contracts" ON COMMIT DROP AS
     SELECT "id" FROM "contracts" WHERE "id" NOT IN (SELECT "id" FROM "purge_contracts")`,
  // Tickets carry no contract: those of the same customer on the same unit go, unless the
  // customer still has another contract on that unit.
  `CREATE TEMP TABLE "purge_tickets" ON COMMIT DROP AS
     SELECT DISTINCT t."id" FROM "service_tickets" t
       JOIN "purge_contracts" pc
         ON pc."customer_id" = t."customer_id" AND pc."storage_unit_id" = t."storage_unit_id"
      WHERE NOT EXISTS (
        SELECT 1 FROM "contracts" o JOIN "booking_items" obi ON obi."id" = o."booking_item_id"
         WHERE o."customer_id" = t."customer_id" AND obi."storage_unit_id" = t."storage_unit_id"
           AND o."id" NOT IN (SELECT "id" FROM "purge_contracts"))`,
  // Payments must go before their invoice/booking: SET NULL on both would break their CHECK.
  `CREATE TEMP TABLE "purge_payments" ON COMMIT DROP AS
     SELECT "id" FROM "payments"
      WHERE "invoice_id" IN (SELECT "id" FROM "purge_invoices")
         OR "booking_id" IN (SELECT "id" FROM "purge_bookings")`,
];

const IN_CONTRACTS = `IN (SELECT "id" FROM "purge_contracts")`;

/** Documents of a purged contract go, except identity papers still tied to a person or facility. */
const DOCUMENTS = `"documents" WHERE "contract_id" ${IN_CONTRACTS}
  AND ("type" <> 'IDENTITY' OR ("owner_user_id" IS NULL AND "facility_id" IS NULL))`;

const NOTIFICATIONS = `"notifications"
  WHERE "data"->>'contractId' IN (SELECT "id"::text FROM "purge_contracts")
     OR "data"->>'invoiceId' IN (SELECT "id"::text FROM "purge_invoices")
     OR "data"->>'ticketId' IN (SELECT "id"::text FROM "purge_tickets")`;

const REFUNDS = `"refunds"
  WHERE "payment_id" IN (SELECT "id" FROM "purge_payments")
     OR "deposit_id" IN (SELECT "id" FROM "deposits" WHERE "contract_id" ${IN_CONTRACTS})`;

/** What each table loses, cascades included; logged before deleting. */
const EXPECTED: [string, string][] = [
  ['contracts', `SELECT count(*) FROM "purge_contracts"`],
  [
    'contracts_soft_deleted',
    `SELECT count(*) FROM "contracts" WHERE "id" ${IN_CONTRACTS} AND "deleted_at" IS NOT NULL`,
  ],
  ['invoices', `SELECT count(*) FROM "purge_invoices"`],
  [
    'invoice_items',
    `SELECT count(*) FROM "invoice_items" WHERE "invoice_id" IN (SELECT "id" FROM "purge_invoices")`,
  ],
  ['payments', `SELECT count(*) FROM "purge_payments"`],
  ['refunds', `SELECT count(*) FROM ${REFUNDS}`],
  ['inspections', `SELECT count(*) FROM "inspections" WHERE "contract_id" ${IN_CONTRACTS}`],
  [
    'damage_fees',
    `SELECT count(*) FROM "damage_fees" WHERE "inspection_id" IN (SELECT "id" FROM "inspections" WHERE "contract_id" ${IN_CONTRACTS})`,
  ],
  ['deposits', `SELECT count(*) FROM "deposits" WHERE "contract_id" ${IN_CONTRACTS}`],
  ['access_events', `SELECT count(*) FROM "access_events" WHERE "contract_id" ${IN_CONTRACTS}`],
  ['handover_assets', `SELECT count(*) FROM "handover_assets" WHERE "contract_id" ${IN_CONTRACTS}`],
  [
    'unit_change_requests',
    `SELECT count(*) FROM "unit_change_requests" WHERE "contract_id" ${IN_CONTRACTS}`,
  ],
  ['documents', `SELECT count(*) FROM ${DOCUMENTS}`],
  [
    'documents_detached',
    `SELECT count(*) FROM "documents" WHERE "contract_id" ${IN_CONTRACTS}
       AND "type" = 'IDENTITY' AND ("owner_user_id" IS NOT NULL OR "facility_id" IS NOT NULL)`,
  ],
  ['feedback', `SELECT count(*) FROM "feedback" WHERE "contract_id" ${IN_CONTRACTS}`],
  ['service_tickets', `SELECT count(*) FROM "purge_tickets"`],
  ['notifications', `SELECT count(*) FROM ${NOTIFICATIONS}`],
  ['bookings', `SELECT count(*) FROM "purge_bookings"`],
  [
    'booking_items',
    `SELECT count(*) FROM "booking_items" WHERE "booking_id" IN (SELECT "id" FROM "purge_bookings")`,
  ],
  [
    'unit_holds',
    `SELECT count(*) FROM "unit_holds" WHERE "booking_id" IN (SELECT "id" FROM "purge_bookings")`,
  ],
];

/**
 * Ordered so no foreign key ever fires a SET NULL that a CHECK rejects. Cascades: invoices →
 * invoice_items; contracts → inspections (→ damage_fees), deposits, access_events,
 * handover_assets, unit_change_requests; bookings → booking_items, unit_holds.
 */
const DELETES: [string, string][] = [
  ['notifications', `DELETE FROM ${NOTIFICATIONS}`],
  ['refunds', `DELETE FROM ${REFUNDS}`],
  ['payments', `DELETE FROM "payments" WHERE "id" IN (SELECT "id" FROM "purge_payments")`],
  // Deleted, not detached: an invoice without a contract would still block check-in as overdue.
  ['invoices', `DELETE FROM "invoices" WHERE "id" IN (SELECT "id" FROM "purge_invoices")`],
  [
    'service_tickets',
    `DELETE FROM "service_tickets" WHERE "id" IN (SELECT "id" FROM "purge_tickets")`,
  ],
  ['documents', `DELETE FROM ${DOCUMENTS}`],
  ['feedback', `DELETE FROM "feedback" WHERE "contract_id" ${IN_CONTRACTS}`],
  ['contracts', `DELETE FROM "contracts" WHERE "id" ${IN_CONTRACTS}`],
  // Re-checked at delete time: the booking_items cascade would take any contract created since.
  [
    'bookings',
    `DELETE FROM "bookings" b WHERE b."id" IN (SELECT "id" FROM "purge_bookings")
       AND NOT EXISTS (SELECT 1 FROM "booking_items" o JOIN "contracts" oc ON oc."booking_item_id" = o."id"
                        WHERE o."booking_id" = b."id")`,
  ],
];

/**
 * Bookings kept only because an item never had a contract: after the purge none of their items
 * has one, so the purged item looks like it is still waiting for its first contract.
 */
const KEPT_WITHOUT_CONTRACTS = `SELECT DISTINCT b."booking_no" FROM "purge_contracts" pc
  JOIN "bookings" b ON b."id" = pc."booking_id"
 WHERE b."id" NOT IN (SELECT "id" FROM "purge_bookings")
   AND NOT EXISTS (SELECT 1 FROM "booking_items" o JOIN "contracts" oc ON oc."booking_item_id" = o."id"
                    WHERE o."booking_id" = b."id" AND oc."id" NOT IN (SELECT "id" FROM "purge_contracts"))
 ORDER BY 1`;

/**
 * Live contracts whose item had its unit changed on an ended contract of the same item (a renewal,
 * or a new contract after the ended one was soft-deleted). Deleting that contract deletes the
 * change request too, so the item looks unchanged and its overwritten deposit snapshot would pass
 * for the deposit paid.
 */
const LIVE_WITH_PURGED_CHANGE = `SELECT DISTINCT l."contract_no" FROM "contracts" l
 WHERE l."status" IN ('DRAFT', 'ACTIVE') AND l."deleted_at" IS NULL
   AND EXISTS (SELECT 1 FROM "contracts" e JOIN "unit_change_requests" r ON r."contract_id" = e."id"
                WHERE e."booking_item_id" = l."booking_item_id" AND r."status" = 'COMPLETED'
                  AND e."id" IN (SELECT "id" FROM "purge_contracts"))
 ORDER BY 1`;

/** Holds the items of the bookings about to go, so no contract can be added to them unseen. */
const LOCK_PURGED_BOOKING_ITEMS = `SELECT 1 FROM "booking_items"
  WHERE "booking_id" IN (SELECT "id" FROM "purge_bookings") FOR UPDATE`;

const count = async (queryRunner: QueryRunner, sql: string): Promise<number> =>
  Number((await queryRunner.query(sql))[0].count);

/**
 * Hard-deletes every ENDED contract (soft-deleted ones too) and the data that only exists
 * because of it: invoices and their payments, inspections, deposits, access passes, change
 * requests, documents, feedback, matching tickets and notifications, and bookings left without
 * any contract. Users, storage units (status untouched), audit logs and waitlist entries stay;
 * uploaded files become unreferenced. Contracts that ended before deposit settlement existed
 * would otherwise sit in the settlement queue with no reliable figures.
 *
 * Irreversible: take a database backup right before deploying. It runs before the settlement
 * schema in the same transaction, so a failure in either leaves the database untouched.
 */
export class PurgeEndedContracts1791965000000 implements MigrationInterface {
  name = 'PurgeEndedContracts1791965000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // The temporary sets are dropped at commit; outside a transaction they would vanish at once.
    if (!queryRunner.isTransactionActive) {
      throw new Error('PurgeEndedContracts must run inside a transaction');
    }
    // Fail fast instead of queueing behind live traffic; the deploy can simply be retried.
    await queryRunner.query(`SET LOCAL lock_timeout = '3s'`);
    for (const statement of TEMP_SETS) await queryRunner.query(statement);

    const expected: string[] = [];
    for (const [table, sql] of EXPECTED) expected.push(`${table}=${await count(queryRunner, sql)}`);
    console.log(`PurgeEndedContracts: rows to delete ${expected.join(', ')}`);
    const keptBare: { booking_no: string }[] = await queryRunner.query(KEPT_WITHOUT_CONTRACTS);
    if (keptBare.length > 0) {
      console.log(
        `PurgeEndedContracts: kept booking(s) with an item that never had a contract; they will have no contract left, do not run backfill:contracts on them: ${keptBare.map((row) => row.booking_no).join(', ')}`,
      );
    }

    const purgedChange: { contract_no: string }[] =
      await queryRunner.query(LIVE_WITH_PURGED_CHANGE);
    if (purgedChange.length > 0) {
      console.log(
        `PurgeEndedContracts: the unit change of these live contracts' items is on an ended contract being deleted, so their deposit can no longer be derived; they must be listed in REVIEWED_DEPOSITS: ${purgedChange.map((row) => row.contract_no).join(', ')}`,
      );
    }

    const expectedBookings = await count(queryRunner, `SELECT count(*) FROM "purge_bookings"`);
    const orphanInvoicesBefore = await count(
      queryRunner,
      `SELECT count(*) FROM "invoices" WHERE "contract_id" IS NULL`,
    );
    const deleted: string[] = [];
    for (const [table, sql] of DELETES) {
      // A concurrent contract insert needs a key-share lock on its booking item; this waits for
      // (or blocks) it, so the re-check in the bookings DELETE sees every contract.
      if (table === 'bookings') await queryRunner.query(LOCK_PURGED_BOOKING_ITEMS);
      const [, affected] = await queryRunner.query(sql);
      deleted.push(`${table}=${affected}`);
      // A purged booking whose deposit payment is already gone must not survive half-deleted.
      if (table === 'bookings' && affected !== expectedBookings) {
        throw new Error(
          `PurgeEndedContracts: ${expectedBookings - affected} booking(s) got a contract while the migration ran; nothing was deleted`,
        );
      }
    }

    const remaining = await count(
      queryRunner,
      `SELECT count(*) FROM "contracts" WHERE "status" = 'ENDED'`,
    );
    if (remaining > 0) {
      throw new Error(
        `PurgeEndedContracts: ${remaining} ENDED contract(s) remain (ended while the migration ran?); nothing was deleted`,
      );
    }
    const lost = await count(
      queryRunner,
      `SELECT count(*) FROM "kept_contracts" k WHERE NOT EXISTS (SELECT 1 FROM "contracts" c WHERE c."id" = k."id")`,
    );
    if (lost > 0) {
      throw new Error(
        `PurgeEndedContracts: ${lost} contract(s) that are not ENDED would be deleted; nothing was deleted`,
      );
    }
    const orphanInvoicesAfter = await count(
      queryRunner,
      `SELECT count(*) FROM "invoices" WHERE "contract_id" IS NULL`,
    );
    if (orphanInvoicesAfter !== orphanInvoicesBefore) {
      throw new Error(
        'PurgeEndedContracts: invoices were left without a contract; nothing was deleted',
      );
    }
    console.log(`PurgeEndedContracts: deleted ${deleted.join(', ')}`);
  }

  async down(): Promise<void> {
    throw new Error('PurgeEndedContracts is irreversible; restore the pre-merge backup instead.');
  }
}
