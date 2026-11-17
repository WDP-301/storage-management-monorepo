import { randomUUID } from 'node:crypto';
import { Contract } from '@entities/contract.entity';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { contractCancelledNotification } from '@modules/settlements/settlement-notifications';
import { Logger } from '@nestjs/common';
import {
  ContractStatus,
  DepositStatus,
  InspectionType,
  InvoiceStatus,
  PaymentStatus,
  type SettlementLine,
  SettlementLineType,
  SettlementStatus,
  StorageUnitStatus,
} from '@storage/types';
import { type EntityManager, In, IsNull } from 'typeorm';
import { DEPOSIT_COLUMNS, type LedgerDeposit } from './deposit-ledger.query';
import { resolveContractDeposit } from './deposit-ledger.util';
import { loadSavedRefundAccount } from './refund-account.util';

const logger = new Logger('DraftContractTeardown');

export interface TeardownDraftInput {
  contract: Pick<Contract, 'id' | 'contractNo' | 'customerId' | 'bookingItemId' | 'status'>;
  storageUnitId?: string | null;
  actorId?: string | null;
  now?: Date;
  contractNote?: string;
  settlementNote?: string;
}

export interface TeardownDraftResult {
  settlementId: string | null;
  refundAmount: number;
}

interface PaidInvoiceRow {
  payment_id: string;
  amount: number;
  invoice_id: string;
  invoice_no: string;
}

/**
 * Shared cancellation path for an unsigned DRAFT contract:
 * resolves any deposit ledger row, voids open/partially-paid invoices, releases its unit,
 * clears unassigned handover assignments, and queues an AWAITING_REFUND settlement (pre-filled
 * with the customer's saved bank account if any) whenever money was captured.
 *
 * For a unit-change destination DRAFT whose deposit still lives on the old contract,
 * `resolveContractDeposit` returns null; if FIRST_RENT was already paid, a zero-amount
 * deposit row is created so the settlement has a ledger anchor for the rent refund.
 */
export async function teardownDraftContract(
  em: EntityManager,
  input: TeardownDraftInput,
): Promise<TeardownDraftResult> {
  const now = input.now ?? new Date();
  const { contract } = input;
  let deposit = await resolveContractDeposit(em, contract, { create: true });

  const paid: PaidInvoiceRow[] = await em.query(
    `SELECT p.id AS payment_id, p.amount::float8 AS amount,
            i.id AS invoice_id, i.invoice_no
       FROM payments p JOIN invoices i ON i.id = p.invoice_id
      WHERE i.contract_id = $1 AND p.status = $2
      ORDER BY p.created_at`,
    [contract.id, PaymentStatus.SUCCEEDED],
  );

  await em.update(
    Contract,
    { id: contract.id },
    {
      status: ContractStatus.CANCELLED,
      ...(input.contractNote ? { note: input.contractNote } : {}),
    },
  );
  if (input.storageUnitId) {
    await em.update(
      StorageUnit,
      { id: input.storageUnitId, status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
      { status: StorageUnitStatus.AVAILABLE },
    );
  }
  await em.update(
    Invoice,
    {
      contractId: contract.id,
      status: In([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID]),
    },
    { status: InvoiceStatus.VOID },
  );
  // Prevent closed drafts from remaining in staff queues or re-entering handover rotation.
  await em.update(
    Inspection,
    { contractId: contract.id, type: InspectionType.PRE_HANDOVER, finalizedAt: IsNull() },
    { inspectedBy: null },
  );

  const credits: SettlementLine[] = paid.map((row) => ({
    type: SettlementLineType.UNUSED_PERIOD_CREDIT,
    direction: 'CREDIT',
    description: `Hoàn tiền đã thu trên hóa đơn ${row.invoice_no} — hủy trước bàn giao`,
    quantity: 1,
    unit_amount: row.amount,
    amount: row.amount,
    waived: false,
    waive_reason: null,
    needs_decision: false,
    invoice_id: row.invoice_id,
    invoice_no: row.invoice_no,
    payment_id: row.payment_id,
  }));
  const depositAmount = Number(deposit?.amount ?? 0);
  const creditsTotal = credits.reduce((sum, line) => sum + line.amount, 0);
  const refundAmount = depositAmount + creditsTotal;

  if (!deposit && creditsTotal > 0) {
    const inserted: LedgerDeposit[] = await em.query(
      `INSERT INTO deposits (contract_id, payment_id, amount_snapshot, held_amount, status)
       VALUES ($1::uuid, NULL, 0, 0, '${DepositStatus.HELD}')
       ON CONFLICT (contract_id) DO NOTHING
       RETURNING ${DEPOSIT_COLUMNS}`,
      [contract.id],
    );
    if (inserted[0]) {
      deposit = inserted[0];
    } else {
      const existing: LedgerDeposit[] = await em.query(
        `SELECT ${DEPOSIT_COLUMNS} FROM deposits d WHERE d.contract_id = $1 FOR UPDATE`,
        [contract.id],
      );
      deposit = existing[0] ?? null;
    }
  }

  let settlementId: string | null = null;
  if (deposit && refundAmount > 0) {
    const savedAccount = await loadSavedRefundAccount(em, contract.customerId);
    settlementId = randomUUID();
    await em.insert(ContractSettlement, {
      id: settlementId,
      contractId: contract.id,
      depositId: deposit.id,
      status: SettlementStatus.AWAITING_REFUND,
      lines: credits,
      depositAmount,
      creditsTotal,
      deductionsTotal: 0,
      refundAmount,
      shortfallAmount: 0,
      customerBankAccount: savedAccount,
      bankAccount: savedAccount,
      note: input.settlementNote ?? 'Hủy hợp đồng trước bàn giao — hoàn lại toàn bộ tiền đã thu',
      approvedBy: input.actorId && input.actorId !== 'system' ? input.actorId : null,
      approvedAt: now,
    });
  } else if (refundAmount > 0) {
    logger.warn(
      `Contract ${contract.id} cancelled with ${refundAmount} captured but no resolvable deposit — manual refund needed`,
    );
  }

  return { settlementId, refundAmount };
}

export { contractCancelledNotification };
