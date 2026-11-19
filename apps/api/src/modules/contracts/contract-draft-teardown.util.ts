import { randomUUID } from 'node:crypto';
import { Contract } from '@entities/contract.entity';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import { Deposit } from '@entities/deposit.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { activeRoleHolderIds, BACK_OFFICE_ROLES } from '@modules/auth/role-assignment.util';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import {
  contractCancelledNotification,
  contractRefundPendingNotification,
} from '@modules/settlements/settlement-notifications';
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
  /** The customer never came: the branch keeps the deposit, money paid on invoices is refunded. */
  keepDeposit?: boolean;
  /** When given, the back office is told about the refund the cancel queued. */
  notifications?: Pick<NotificationsService, 'createForUsers'>;
}

export interface TeardownDraftResult {
  settlementId: string | null;
  refundAmount: number;
  /** Deposit kept by the branch (no-show); 0 when it is refunded. */
  forfeitedAmount: number;
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
 * with the customer's saved bank account if any) whenever money is to be returned. A kept deposit
 * (`keepDeposit`) is recorded as a deduction; with nothing left to return the settlement is
 * COMPLETED at once and the deposit FORFEITED.
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
  const forfeitedAmount = input.keepDeposit ? depositAmount : 0;
  const refundAmount = depositAmount - forfeitedAmount + creditsTotal;
  const lines = forfeitedAmount > 0 ? [...credits, noShowForfeitLine(forfeitedAmount)] : credits;

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
  if (deposit && (refundAmount > 0 || forfeitedAmount > 0)) {
    const savedAccount = await loadSavedRefundAccount(em, contract.customerId);
    const actorId = input.actorId && input.actorId !== 'system' ? input.actorId : null;
    const completed = refundAmount === 0;
    settlementId = randomUUID();
    await em.insert(ContractSettlement, {
      id: settlementId,
      contractId: contract.id,
      depositId: deposit.id,
      status: completed ? SettlementStatus.COMPLETED : SettlementStatus.AWAITING_REFUND,
      lines,
      depositAmount,
      creditsTotal,
      deductionsTotal: forfeitedAmount,
      refundAmount,
      shortfallAmount: 0,
      customerBankAccount: savedAccount,
      bankAccount: savedAccount,
      note:
        input.settlementNote ??
        (forfeitedAmount > 0
          ? 'Hủy hợp đồng do khách không đến nhận kho — giữ tiền cọc'
          : 'Hủy hợp đồng trước bàn giao — hoàn lại toàn bộ tiền đã thu'),
      approvedBy: actorId,
      approvedAt: now,
      ...(completed ? { completedBy: actorId, completedAt: now } : {}),
    });
    if (completed) {
      await em.update(
        Deposit,
        { id: deposit.id },
        { heldAmount: 0, status: DepositStatus.FORFEITED },
      );
    } else if (input.notifications) {
      await input.notifications.createForUsers(
        em,
        await activeRoleHolderIds(em, BACK_OFFICE_ROLES),
        contractRefundPendingNotification(contract, settlementId, refundAmount),
      );
    }
  } else if (refundAmount > 0) {
    logger.warn(
      `Contract ${contract.id} cancelled with ${refundAmount} captured but no resolvable deposit — manual refund needed`,
    );
  }

  return { settlementId, refundAmount, forfeitedAmount };
}

function noShowForfeitLine(amount: number): SettlementLine {
  return {
    type: SettlementLineType.NO_SHOW_FORFEIT,
    direction: 'DEDUCTION',
    description: 'Giữ tiền cọc — khách không đến nhận kho',
    quantity: 1,
    unit_amount: amount,
    amount,
    waived: false,
    waive_reason: null,
    needs_decision: false,
  };
}

export { contractCancelledNotification };
