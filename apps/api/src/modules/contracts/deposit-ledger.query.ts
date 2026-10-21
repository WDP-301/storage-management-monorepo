import type { Contract } from '@entities/contract.entity';
import {
  BookingStatus,
  ChangeRequestStatus,
  ContractStatus,
  DepositStatus,
  PaymentStatus,
  PaymentType,
} from '@storage/types';
import type { EntityManager } from 'typeorm';

/** A row of the deposit ledger; amounts are numeric strings exactly as stored. */
export interface LedgerDeposit {
  id: string;
  contractId: string;
  paymentId: string | null;
  amount: string;
  heldAmount: string;
  status: DepositStatus;
}

/** A deposit worked out for reading; `id` is null when it is not recorded for the contract yet. */
export type ResolvedDeposit = Omit<LedgerDeposit, 'id' | 'contractId'> & { id: string | null };

export type DepositContract = Pick<Contract, 'id' | 'bookingItemId' | 'status'>;

type DepositRow = LedgerDeposit & { bookingItemId?: string; contractStatus?: ContractStatus };

export const DEPOSIT_COLUMNS = `d.id, d.contract_id AS "contractId", d.payment_id AS "paymentId",
  d.amount_snapshot AS "amount", d.held_amount AS "heldAmount", d.status`;

/**
 * (item_id, amount, payment_id) for the booking items in the uuid[] parameter `param`: what the
 * customer paid as deposit for each item, derived from its CONFIRMED booking. A completed unit
 * change overwrites the item's deposit snapshot with the new unit's, while the booking total keeps
 * what was paid; so a single item takes the booking total, an unchanged item its own snapshot,
 * the only changed item the total minus the others' snapshots, and anything else has a NULL
 * amount (cannot be told apart). `payment_id` is the latest successful deposit transfer.
 *
 * The subtraction trusts the other items' snapshots only while every other item still has a
 * contract (any status, soft-deleted included): an item whose contracts were removed has also
 * lost the change requests that would show its snapshot was overwritten.
 * Keep in sync with the copy in the ReturnSettlement migration.
 */
export function paidDepositByItemSql(param: string): string {
  return `
    WITH items AS (
      SELECT o.id, o.booking_id, o.deposit_snapshot,
             EXISTS (SELECT 1 FROM contracts c
                       JOIN unit_change_requests r ON r.contract_id = c.id
                      WHERE c.booking_item_id = o.id
                        AND r.status = '${ChangeRequestStatus.COMPLETED}') AS changed,
             EXISTS (SELECT 1 FROM contracts c WHERE c.booking_item_id = o.id) AS has_contract
        FROM booking_items o
       WHERE o.booking_id IN (SELECT booking_id FROM booking_items WHERE id = ANY(${param}::uuid[]))
    ), per_booking AS (
      SELECT booking_id, count(*) AS item_count, sum(deposit_snapshot) AS snapshot_sum,
             count(*) FILTER (WHERE changed) AS changed_count,
             count(*) FILTER (WHERE NOT has_contract) AS contractless_count
        FROM items GROUP BY booking_id
    )
    SELECT i.id AS item_id,
           CASE
             WHEN pb.item_count = 1 THEN b.deposit_total
             WHEN NOT i.changed THEN i.deposit_snapshot
             WHEN pb.changed_count = 1 AND pb.contractless_count = 0
              AND b.deposit_total - (pb.snapshot_sum - i.deposit_snapshot) >= 0
               THEN b.deposit_total - (pb.snapshot_sum - i.deposit_snapshot)
           END AS amount,
           (SELECT p.id FROM payments p
             WHERE p.booking_id = b.id AND p.type = '${PaymentType.DEPOSIT}'
               AND p.status = '${PaymentStatus.SUCCEEDED}'
             ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS payment_id
      FROM items i
      JOIN per_booking pb ON pb.booking_id = i.booking_id
      JOIN bookings b ON b.id = i.booking_id AND b.status = '${BookingStatus.CONFIRMED}'
     WHERE i.id = ANY(${param}::uuid[])`;
}

const toResolved = (row: DepositRow): ResolvedDeposit => ({
  id: null,
  paymentId: row.paymentId,
  amount: row.amount,
  heldAmount: row.heldAmount,
  status: row.status,
});

/**
 * Deposits of several contracts in three queries, without writing anything. Per contract, in
 * order: its own ledger row; a HELD deposit still on a CANCELLED contract of the same booking
 * item (soft-deleted included), which a re-created contract takes over; the amount derived from
 * the booking, when no contract of the item has a deposit yet (one deposit per item). Otherwise
 * null — never a guessed 0. Within one call the same money is reported for one contract only:
 * a ledger row stays with its own contract when that contract is in the batch, and a left-over
 * or derived deposit goes to the first contract of the item in input order.
 */
export async function resolveDeposits(
  em: EntityManager,
  contracts: DepositContract[],
): Promise<Map<string, ResolvedDeposit | null>> {
  const result = new Map<string, ResolvedDeposit | null>();
  if (contracts.length === 0) return result;

  const own: DepositRow[] = await em.query(
    `SELECT ${DEPOSIT_COLUMNS} FROM deposits d WHERE d.contract_id = ANY($1::uuid[])`,
    [contracts.map((c) => c.id)],
  );
  const ownByContract = new Map(own.map((row) => [row.contractId, row]));
  const open = contracts.filter(
    (c) => !ownByContract.has(c.id) && c.status !== ContractStatus.CANCELLED,
  );
  const itemIds = [...new Set(open.map((c) => c.bookingItemId))];

  const onItem = new Map<string, DepositRow[]>();
  const derived = new Map<string, { amount: string | null; payment_id: string | null }>();
  if (itemIds.length > 0) {
    const rows: DepositRow[] = await em.query(
      `SELECT ${DEPOSIT_COLUMNS}, c.booking_item_id AS "bookingItemId", c.status AS "contractStatus"
         FROM deposits d JOIN contracts c ON c.id = d.contract_id
        WHERE c.booking_item_id = ANY($1::uuid[])
        ORDER BY d.created_at DESC, d.id DESC`,
      [itemIds],
    );
    for (const row of rows) {
      const key = row.bookingItemId as string;
      onItem.set(key, [...(onItem.get(key) ?? []), row]);
    }
    const derivable = itemIds.filter((id) => !onItem.has(id));
    if (derivable.length > 0) {
      const paid: { item_id: string; amount: string | null; payment_id: string | null }[] =
        await em.query(paidDepositByItemSql('$1'), [derivable]);
      for (const row of paid) derived.set(row.item_id, row);
    }
  }

  const claimedDeposits = new Set(own.map((row) => row.id));
  const claimedItems = new Set<string>();
  for (const contract of contracts) {
    // A contract listed twice keeps its first answer; a second pass would see its own claim.
    if (result.has(contract.id)) continue;
    const mine = ownByContract.get(contract.id);
    if (mine) {
      result.set(contract.id, { ...toResolved(mine), id: mine.id });
      continue;
    }
    if (contract.status === ContractStatus.CANCELLED) {
      result.set(contract.id, null);
      continue;
    }
    const recorded = onItem.get(contract.bookingItemId) ?? [];
    const leftOver = recorded.find(
      (row) => row.contractStatus === ContractStatus.CANCELLED && row.status === DepositStatus.HELD,
    );
    if (leftOver && !claimedDeposits.has(leftOver.id)) {
      claimedDeposits.add(leftOver.id);
      result.set(contract.id, toResolved(leftOver));
      continue;
    }
    if (recorded.length > 0 || claimedItems.has(contract.bookingItemId)) {
      result.set(contract.id, null);
      continue;
    }
    claimedItems.add(contract.bookingItemId);
    const paid = derived.get(contract.bookingItemId);
    result.set(
      contract.id,
      paid?.amount == null
        ? null
        : {
            id: null,
            paymentId: paid.payment_id,
            amount: paid.amount,
            heldAmount: paid.amount,
            status: DepositStatus.HELD,
          },
    );
  }
  return result;
}

/** Deposit amount per contract for read models; null when it cannot be determined. */
export async function resolveDepositAmounts(
  em: EntityManager,
  contracts: DepositContract[],
): Promise<Map<string, string | null>> {
  const deposits = await resolveDeposits(em, contracts);
  return new Map([...deposits].map(([id, deposit]) => [id, deposit?.amount ?? null]));
}
