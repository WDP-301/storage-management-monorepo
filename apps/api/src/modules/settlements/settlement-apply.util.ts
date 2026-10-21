import type { Contract } from '@entities/contract.entity';
import { Deposit } from '@entities/deposit.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { Payment } from '@entities/payment.entity';
import { sumInvoicePayments } from '@modules/contracts/first-rent.util';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import { generatePaymentNo } from '@modules/payments/payment-no.util';
import { addVietnamDays, fromVietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import {
  InvoiceItemType,
  InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  type SettlementLine,
  SettlementLineType,
  SettlementStatus,
  type SettlementTotals,
} from '@storage/types';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';
import { settledDepositStatus } from './settlement-totals';

/** Days the customer has to pay what the deposit did not cover. */
export const SETTLEMENT_INVOICE_DUE_DAYS = 7;

export interface ApplySettlementInput {
  settlementId: string;
  contract: Pick<Contract, 'id' | 'contractNo' | 'customerId' | 'monthlyPriceSnapshot'>;
  depositId: string;
  /** Lines as approved; debts are already ordered oldest due first. */
  lines: SettlementLine[];
  totals: SettlementTotals;
  /** Rent invoices of the contract by id, for their total and due date. */
  invoices: Map<string, { total: Decimal.Value; dueAt: Date | null }>;
  now: Date;
}

/** An invoice the deposit did not cover in full: what the customer still owes on it. */
export interface OpenInvoice {
  invoiceId: string;
  invoiceNo: string;
  amountDue: number;
  dueAt: Date | null;
}

export interface AppliedSettlement {
  feeInvoice: Invoice | null;
  /** Rent invoices left unpaid after the offset, oldest due first, then the fee invoice. */
  openInvoices: OpenInvoice[];
  status: SettlementStatus;
}

async function takeFromDeposit(
  em: EntityManager,
  args: { invoiceId: string; total: Decimal.Value; amount: Decimal; type: PaymentType },
  input: ApplySettlementInput,
): Promise<void> {
  await em.save(
    Payment,
    em.create(Payment, {
      paymentNo: generatePaymentNo(),
      invoiceId: args.invoiceId,
      customerId: input.contract.customerId,
      type: args.type,
      method: PaymentMethod.DEPOSIT,
      status: PaymentStatus.SUCCEEDED,
      amount: args.amount.toNumber(),
      paidAt: input.now,
      metadata: { settlementId: input.settlementId },
    }),
  );
  const paid = await sumInvoicePayments(em, args.invoiceId);
  const status = paid.gte(args.total)
    ? InvoiceStatus.PAID
    : paid.gt(0)
      ? InvoiceStatus.PARTIALLY_PAID
      : InvoiceStatus.ISSUED;
  await em.update(Invoice, { id: args.invoiceId }, { status });
}

/** One invoice for the approved fees (tax 0, due in 7 Vietnam days), one item per fee. */
async function issueSettlementInvoice(
  em: EntityManager,
  input: ApplySettlementInput,
  fees: SettlementLine[],
  total: Decimal,
): Promise<Invoice> {
  const invoice = await em.save(
    Invoice,
    em.create(Invoice, {
      invoiceNo: generateInvoiceNo(),
      customerId: input.contract.customerId,
      contractId: input.contract.id,
      periodNo: 1,
      kind: InvoiceKind.SETTLEMENT,
      months: 1,
      monthlyPriceSnapshot: input.contract.monthlyPriceSnapshot,
      status: InvoiceStatus.ISSUED,
      currency: 'VND',
      subtotal: total.toNumber(),
      taxAmount: 0,
      total: total.toNumber(),
      issuedAt: input.now,
      dueAt: fromVietnamDate(addVietnamDays(vietnamToday(input.now), SETTLEMENT_INVOICE_DUE_DAYS)),
      billingInfo: { settlementId: input.settlementId },
    }),
  );
  await em.save(
    InvoiceItem,
    fees.map((fee) =>
      em.create(InvoiceItem, {
        invoiceId: invoice.id,
        itemType:
          fee.type === SettlementLineType.DAMAGE
            ? InvoiceItemType.DAMAGE
            : InvoiceItemType.ADJUSTMENT,
        description: fee.description.slice(0, 255),
        quantity: fee.quantity,
        unitAmount: fee.unit_amount,
        amount: fee.amount,
      }),
    ),
  );
  return invoice;
}

/**
 * Carries out an approved settlement on the caller's transaction (contract, deposit and rent
 * invoices locked): the pool (deposit + credits) pays the debts oldest due first, then the fees,
 * which are billed on a SETTLEMENT invoice — PAID when the pool covered them, open for the
 * rest otherwise. Rent the pool did not cover stays due on its own invoice, so a shortfall can be
 * spread over several invoices; each is reported with what is still due on it. Every amount taken is a DEPOSIT payment tagged with the settlement, and
 * so are the credited payments, which can never be credited twice. Nothing to refund completes
 * the settlement and releases the deposit now; otherwise it waits for the manual transfer.
 */
export async function applySettlement(
  em: EntityManager,
  input: ApplySettlementInput,
): Promise<AppliedSettlement> {
  const { lines, totals } = input;
  let pool = new Decimal(totals.deposit_amount).plus(totals.credits_total);
  const openInvoices: OpenInvoice[] = [];

  for (const debt of lines.filter((l) => l.type === SettlementLineType.UNPAID_INVOICE)) {
    const invoiceId = debt.invoice_id as string;
    const invoice = input.invoices.get(invoiceId);
    const amount = Decimal.min(pool, debt.amount);
    if (amount.gt(0)) {
      const total = invoice?.total ?? debt.amount;
      await takeFromDeposit(em, { invoiceId, total, amount, type: PaymentType.RENT }, input);
      pool = pool.minus(amount);
    }
    // Rent the deposit could not cover stays on its own invoice, never on the fee invoice.
    const left = new Decimal(debt.amount).minus(amount);
    if (left.gt(0)) {
      openInvoices.push({
        invoiceId,
        invoiceNo: debt.invoice_no as string,
        amountDue: left.toNumber(),
        dueAt: invoice?.dueAt ?? null,
      });
    }
  }

  const fees = lines.filter(
    (l) =>
      l.direction === 'DEDUCTION' && l.type !== SettlementLineType.UNPAID_INVOICE && l.amount > 0,
  );
  let feeInvoice: Invoice | null = null;
  if (fees.length > 0) {
    const total = fees.reduce((sum, fee) => sum.plus(fee.amount), new Decimal(0));
    feeInvoice = await issueSettlementInvoice(em, input, fees, total);
    const amount = Decimal.min(pool, total);
    if (amount.gt(0)) {
      const args = { invoiceId: feeInvoice.id, total, amount, type: PaymentType.FEE };
      await takeFromDeposit(em, args, input);
      pool = pool.minus(amount);
    }
    if (total.gt(amount)) {
      openInvoices.push({
        invoiceId: feeInvoice.id,
        invoiceNo: feeInvoice.invoiceNo,
        amountDue: total.minus(amount).toNumber(),
        dueAt: feeInvoice.dueAt ?? null,
      });
    }
  }

  const credited = lines
    .filter((l) => l.direction === 'CREDIT' && l.amount > 0 && l.payment_id)
    .map((l) => l.payment_id as string);
  if (credited.length > 0) {
    await em.query(
      `UPDATE payments SET metadata = metadata || jsonb_build_object('settlementId', $1::text)
        WHERE id = ANY($2::uuid[])`,
      [input.settlementId, credited],
    );
  }

  if (totals.refund_amount > 0) {
    return { feeInvoice, openInvoices, status: SettlementStatus.AWAITING_REFUND };
  }
  await em.update(
    Deposit,
    { id: input.depositId },
    { heldAmount: 0, status: settledDepositStatus(totals) },
  );
  return { feeInvoice, openInvoices, status: SettlementStatus.COMPLETED };
}
