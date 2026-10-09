/**
 * Wipes all business data (warehouses, bookings, contracts, payments, tickets, tours…),
 * applies pending migrations and seeds demo facilities (branches) with their warehouses plus
 * demo accounts:
 *   pnpm --filter @storage/api db:reset-demo --yes                       # local database
 *   pnpm --filter @storage/api db:reset-demo --yes --allow-remote=<db>   # any other host
 * Facility-scoped demo roles (manager@, staff@) are granted per facility, see DEMO_ACCOUNTS.
 * Users, sessions, customer profiles, settings, provinces/wards and ticket types survive.
 * Demo accounts include an ADMIN, so the committed DEMO_PASSWORD is only used on a local
 * database; any other host needs DEMO_PASSWORD set in the environment, otherwise anyone who
 * has read this repository could sign in as admin. Roles are only granted to demo accounts the
 * script created or that already use the demo password.
 */
import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../data-source';
import { seed } from './demo-seed';
import { DEMO_ACCOUNTS, DEMO_FACILITIES, DEMO_PASSWORD, DEMO_WAREHOUSES } from './demo-seed-data';

const MIN_PASSWORD_LENGTH = 8;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** Child tables first, so every statement runs after the rows that reference it are gone. */
const WIPE_STEPS: { table: string; sql: string }[] = [
  { table: 'refunds', sql: 'DELETE FROM "refunds"' },
  { table: 'deposits', sql: 'DELETE FROM "deposits"' },
  { table: 'payments', sql: 'DELETE FROM "payments"' },
  { table: 'damage_fees', sql: 'DELETE FROM "damage_fees"' },
  { table: 'invoice_items', sql: 'DELETE FROM "invoice_items"' },
  { table: 'invoices', sql: 'DELETE FROM "invoices"' },
  { table: 'access_events', sql: 'DELETE FROM "access_events"' },
  { table: 'handover_assets', sql: 'DELETE FROM "handover_assets"' },
  { table: 'inspections', sql: 'DELETE FROM "inspections"' },
  { table: 'unit_change_requests', sql: 'DELETE FROM "unit_change_requests"' },
  {
    table: 'documents',
    sql: 'DELETE FROM "documents" WHERE "contract_id" IS NOT NULL OR "facility_id" IS NOT NULL',
  },
  { table: 'feedback', sql: 'DELETE FROM "feedback"' },
  { table: 'contracts', sql: 'DELETE FROM "contracts"' },
  { table: 'unit_holds', sql: 'DELETE FROM "unit_holds"' },
  { table: 'booking_items', sql: 'DELETE FROM "booking_items"' },
  { table: 'waitlist_entries', sql: 'DELETE FROM "waitlist_entries"' },
  { table: 'bookings', sql: 'DELETE FROM "bookings"' },
  { table: 'idempotency_keys', sql: 'DELETE FROM "idempotency_keys"' },
  { table: 'notifications', sql: 'DELETE FROM "notifications"' },
  { table: 'service_tickets', sql: 'DELETE FROM "service_tickets"' },
  { table: 'tour_appointments', sql: 'DELETE FROM "tour_appointments"' },
  { table: 'favorites', sql: 'DELETE FROM "favorites"' },
  {
    table: 'audit_logs',
    sql: 'UPDATE "audit_logs" SET "facility_id" = NULL WHERE "facility_id" IS NOT NULL',
  },
  {
    table: 'user_role_assignments',
    sql: 'DELETE FROM "user_role_assignments" WHERE "facility_id" IS NOT NULL',
  },
  { table: 'storage_units', sql: 'DELETE FROM "storage_units"' },
  { table: 'facilities', sql: 'DELETE FROM "facilities"' },
  // Only present before the standalone-warehouse migration ran.
  { table: 'unit_types', sql: 'DELETE FROM "unit_types"' },
];

/**
 * Skips tables that do not exist yet, so the wipe also works on an empty database (the schema is
 * created afterwards by the migrations) and on a database still at the previous schema.
 */
async function wipe(manager: EntityManager): Promise<void> {
  for (const { table, sql } of WIPE_STEPS) {
    const [{ exists }] = await manager.query(`SELECT to_regclass($1) IS NOT NULL AS "exists"`, [
      `public.${table}`,
    ]);
    if (exists) await manager.query(sql);
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('db:reset-demo is disabled in production');
  const target = `${process.env.DB_HOST}/${process.env.DB_DATABASE}`;
  if (!process.argv.includes('--yes')) {
    throw new Error(
      `This deletes every warehouse, booking, contract and payment in ${target}. Re-run with --yes.`,
    );
  }
  if (!process.env.DB_DATABASE) throw new Error('DB_DATABASE is not set');
  // apps/api/.env usually points at a shared database; wiping it must be asked for by name.
  const isLocal = LOCAL_HOSTS.includes(process.env.DB_HOST ?? '');
  if (!isLocal && !process.argv.includes(`--allow-remote=${process.env.DB_DATABASE}`)) {
    throw new Error(
      `${target} is not a local database. Re-run with --allow-remote=${process.env.DB_DATABASE} to wipe it.`,
    );
  }
  const demoPassword = isLocal ? DEMO_PASSWORD : (process.env.DEMO_PASSWORD ?? '');
  if (demoPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${target} is not a local database: set DEMO_PASSWORD (min ${MIN_PASSWORD_LENGTH} ` +
        'characters, not the one in the repository) for the demo accounts.',
    );
  }
  if (!isLocal && demoPassword === DEMO_PASSWORD) {
    throw new Error('DEMO_PASSWORD must differ from the password committed in the repository');
  }

  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(wipe);
    const applied = await AppDataSource.runMigrations({ transaction: 'each' });
    await AppDataSource.transaction((manager) => seed(manager, demoPassword));
    console.log(
      `db:reset-demo: wiped business data, applied ${applied.length} migration(s), seeded ` +
        `${DEMO_FACILITIES.length} facilities, ${DEMO_WAREHOUSES.length} warehouses and ${DEMO_ACCOUNTS.length} demo accounts ` +
        `(${isLocal ? `password ${DEMO_PASSWORD}` : 'password from DEMO_PASSWORD'} for new accounts).`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
