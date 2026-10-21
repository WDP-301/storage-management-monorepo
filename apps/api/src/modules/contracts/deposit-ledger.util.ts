import { Logger } from '@nestjs/common';
import { ContractStatus, DepositStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';
import {
  DEPOSIT_COLUMNS,
  type DepositContract,
  type LedgerDeposit,
  paidDepositByItemSql,
  type ResolvedDeposit,
  resolveDeposits,
} from './deposit-ledger.query';

export type { DepositContract, LedgerDeposit, ResolvedDeposit } from './deposit-ledger.query';
export { resolveDepositAmounts, resolveDeposits } from './deposit-ledger.query';

const logger = new Logger('DepositLedger');

/**
 * Locks and returns the contract's ledger deposit, recording it first when it can be resolved
 * (same order as `resolveDeposits`): a left-over HELD deposit of a CANCELLED contract on the same
 * item is moved over, otherwise the derived amount is inserted. Idempotent; null when unknown.
 */
async function recordContractDeposit(
  em: EntityManager,
  contract: DepositContract,
): Promise<LedgerDeposit | null> {
  const lockOwn = async (): Promise<LedgerDeposit | null> => {
    const [row]: LedgerDeposit[] = await em.query(
      `SELECT ${DEPOSIT_COLUMNS} FROM deposits d WHERE d.contract_id = $1 FOR UPDATE`,
      [contract.id],
    );
    return row ?? null;
  };
  const existing = await lockOwn();
  if (existing || contract.status === ContractStatus.CANCELLED) return existing;

  const [moved]: [LedgerDeposit[], number] = await em.query(
    `UPDATE deposits d SET contract_id = $1, updated_at = now()
      WHERE d.id = (
        SELECT x.id FROM deposits x JOIN contracts c ON c.id = x.contract_id
         WHERE c.booking_item_id = $2 AND c.id <> $1
           AND c.status = '${ContractStatus.CANCELLED}' AND x.status = '${DepositStatus.HELD}'
         ORDER BY x.created_at DESC, x.id DESC LIMIT 1
           FOR UPDATE OF x)
      RETURNING ${DEPOSIT_COLUMNS}`,
    [contract.id, contract.bookingItemId],
  );
  if (moved.length > 0) return moved[0];

  const inserted: LedgerDeposit[] = await em.query(
    `INSERT INTO deposits AS d (contract_id, payment_id, amount_snapshot, held_amount, status)
     SELECT $1::uuid, f.payment_id, f.amount, f.amount, '${DepositStatus.HELD}'
       FROM (${paidDepositByItemSql('$2')}) f
      WHERE f.amount IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM deposits x JOIN contracts c ON c.id = x.contract_id
                         WHERE c.booking_item_id = ANY($2::uuid[]))
     ON CONFLICT (contract_id) DO NOTHING
     RETURNING ${DEPOSIT_COLUMNS}`,
    [contract.id, [contract.bookingItemId]],
  );
  // Nothing inserted: not derivable, or a concurrent transaction recorded it first.
  return inserted[0] ?? lockOwn();
}

/**
 * The single deposit resolver. `create: true` records what it resolves and locks the row (for
 * writers such as settlement); otherwise it only reads. Neither mode ever falls back to 0.
 */
export function resolveContractDeposit(
  em: EntityManager,
  contract: DepositContract,
  options: { create: true },
): Promise<LedgerDeposit | null>;
export function resolveContractDeposit(
  em: EntityManager,
  contract: DepositContract,
  options?: { create?: false },
): Promise<ResolvedDeposit | null>;
export async function resolveContractDeposit(
  em: EntityManager,
  contract: DepositContract,
  options: { create?: boolean } = {},
): Promise<LedgerDeposit | ResolvedDeposit | null> {
  if (options.create) return recordContractDeposit(em, contract);
  return (await resolveDeposits(em, [contract])).get(contract.id) ?? null;
}

/**
 * Records the contract's deposit inside a savepoint and never throws: the caller (deposit
 * confirmation, contract creation, return finalize) must succeed even when the ledger cannot be
 * written. A failure only rolls back to the savepoint and is logged; the settlement repairs it.
 */
export async function captureDepositSafely(
  em: EntityManager,
  contract: DepositContract,
): Promise<LedgerDeposit | null> {
  try {
    const deposit = await em.transaction((savepoint) =>
      resolveContractDeposit(savepoint, contract, { create: true }),
    );
    if (!deposit) logger.warn(`Deposit of contract ${contract.id} cannot be derived yet`);
    return deposit;
  } catch (err) {
    logger.error(
      `Recording the deposit of contract ${contract.id} failed; continuing without it`,
      err instanceof Error ? err.stack : String(err),
    );
    return null;
  }
}
