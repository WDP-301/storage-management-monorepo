import type { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import { addVietnamDays, fromVietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import { InvoiceItemType, InvoiceKind, InvoiceStatus } from '@storage/types';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';

/** Days the customer has to pay a fee invoice. */
export const FEE_INVOICE_DUE_DAYS = 7;

export interface FeeInvoiceLine {
  itemType: InvoiceItemType;
  description: string;
  quantity: number;
  unitAmount: Decimal.Value;
  amount: Decimal.Value;
}

/**
 * Bills charges that are not a rent period (deposit shortfall, damage) on a SETTLEMENT invoice:
 * tax 0, due in 7 Vietnam days, one item per line. The kind sits outside the (contract_id,
 * period_no) unique index, so a contract may carry several; once overdue it blocks the customer
 * like an overdue rent invoice.
 */
export async function issueFeeInvoice(
  em: EntityManager,
  input: {
    contract: Pick<Contract, 'id' | 'customerId' | 'monthlyPriceSnapshot'>;
    lines: FeeInvoiceLine[];
    billingInfo: Record<string, unknown>;
    now: Date;
  },
): Promise<Invoice> {
  const total = input.lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));
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
      dueAt: fromVietnamDate(addVietnamDays(vietnamToday(input.now), FEE_INVOICE_DUE_DAYS)),
      billingInfo: input.billingInfo,
    }),
  );
  await em.save(
    InvoiceItem,
    input.lines.map((line) =>
      em.create(InvoiceItem, {
        invoiceId: invoice.id,
        itemType: line.itemType,
        description: line.description.slice(0, 255),
        quantity: line.quantity,
        unitAmount: new Decimal(line.unitAmount).toNumber(),
        amount: new Decimal(line.amount).toNumber(),
      }),
    ),
  );
  return invoice;
}
