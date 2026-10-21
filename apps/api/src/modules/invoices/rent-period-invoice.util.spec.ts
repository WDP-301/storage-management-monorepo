import type { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { ContractKind, InvoiceItemType, InvoiceStatus, NotificationType } from '@storage/types';
import {
  issueRentPeriodInvoice,
  queueInvoicePdf,
  recurringRentPeriods,
} from './rent-period-invoice.util';

const contract = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'contract-1',
    contractNo: 'CT-1',
    customerId: 'customer-1',
    kind: ContractKind.INITIAL,
    effectiveAt: new Date('2027-01-15T05:00:00.000Z'),
    months: 3,
    monthlyPriceSnapshot: '1500000.00',
    ...overrides,
  }) as unknown as Contract;

describe('recurringRentPeriods', () => {
  it('lists periods 2..months, one calendar month each, oldest first', () => {
    const periods = recurringRentPeriods(contract());

    expect(periods.map((p) => p.periodNo)).toEqual([2, 3]);
    const expected = (months: number) => {
      const at = new Date('2027-01-15T05:00:00.000Z');
      at.setMonth(at.getMonth() + months);
      return at;
    };
    expect(periods[0]).toEqual({ periodNo: 2, startAt: expected(1), endAt: expected(2) });
    expect(periods[1]).toEqual({ periodNo: 3, startAt: expected(2), endAt: expected(3) });
  });

  it.each([
    ['a one-month contract', { months: 1 }],
    ['a contract without a start', { effectiveAt: null }],
    ['a free contract', { monthlyPriceSnapshot: '0.00' }],
  ])('bills nothing for %s', (_label, overrides) => {
    expect(recurringRentPeriods(contract(overrides))).toEqual([]);
  });
});

describe('issueRentPeriodInvoice', () => {
  let em: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  const now = new Date('2027-02-10T00:00:00.000Z');
  const [period] = recurringRentPeriods(contract());

  beforeEach(() => {
    em = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async (entity, data) => (entity === Invoice ? { ...data, id: 'inv-2' } : data)),
    };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
  });

  const issue = (of = contract(), unit: { id: string; code: string } | null = null) =>
    issueRentPeriodInvoice(em as never, of, unit, period, now, notifications as never);

  it('bills one month at the contract price, due when the period starts', async () => {
    const invoice = await issue(contract(), { id: 'unit-1', code: 'A101' });

    expect(invoice).toMatchObject({
      id: 'inv-2',
      contractId: 'contract-1',
      customerId: 'customer-1',
      periodNo: 2,
      kind: ContractKind.INITIAL,
      status: InvoiceStatus.ISSUED,
      startAt: period.startAt,
      endAt: period.endAt,
      dueAt: period.startAt,
      issuedAt: now,
      months: 1,
      subtotal: 1500000,
      taxAmount: 0,
      total: 1500000,
    });
    expect(em.save).toHaveBeenCalledWith(InvoiceItem, {
      invoiceId: 'inv-2',
      storageUnitId: 'unit-1',
      itemType: InvoiceItemType.RENT,
      description: 'Tiền thuê kỳ 2 — Kho A101 (HĐ: CT-1)',
      quantity: 1,
      unitAmount: 1500000,
      amount: 1500000,
    });
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({
        type: NotificationType.INVOICE_ISSUED,
        title: 'Hóa đơn tiền thuê kho kỳ 2',
      }),
    );
  });

  it('keeps the kind of a renewal contract', async () => {
    await expect(issue(contract({ kind: ContractKind.RENEWAL }))).resolves.toMatchObject({
      kind: ContractKind.RENEWAL,
    });
  });

  it('issues nothing when the period already has a live invoice', async () => {
    em.findOne.mockResolvedValue({ id: 'inv-old' });

    await expect(issue()).resolves.toBeNull();
    expect(em.save).not.toHaveBeenCalled();
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });
});

describe('queueInvoicePdf', () => {
  it('queues the PDF render job of the invoice', async () => {
    const queue = { send: jest.fn().mockResolvedValue('job-1') };

    await expect(queueInvoicePdf(queue as never, 'inv-2')).resolves.toBe('job-1');
    expect(queue.send).toHaveBeenCalledWith('invoice.render-pdf', { invoiceId: 'inv-2' });
  });
});
