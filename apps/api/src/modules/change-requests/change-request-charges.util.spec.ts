import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { InvoiceItemType, InvoiceKind, NotificationType } from '@storage/types';
import Decimal from 'decimal.js';
import { settleRentNetOnDeposit } from './change-request-charges.util';

describe('settleRentNetOnDeposit', () => {
  const NOW = new Date('2026-07-01T02:00:00Z');
  const oldContract = { id: 'contract-old', contractNo: 'CT-OLD', customerId: 'customer-1' };
  let em: {
    query: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let notifications: { createForUsers: jest.Mock };

  const run = (rentNet: number, heldAmount: string | null) =>
    settleRentNetOnDeposit(em as never, {
      oldContract,
      newContractId: 'contract-new',
      oldDeposit: heldAmount === null ? null : { id: 'dep-1', heldAmount },
      rentNet: new Decimal(rentNet),
      notifications: notifications as never,
      now: NOW,
    });

  const depositUpdate = () =>
    em.query.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE "deposits"'))?.[1];
  const depositSql = () =>
    em.query.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE "deposits"'))?.[0] as string;
  const savedInvoice = () => em.save.mock.calls.find(([entity]) => entity === Invoice)?.[1];

  beforeEach(() => {
    em = {
      query: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn().mockResolvedValue({
        id: 'contract-new',
        customerId: 'customer-1',
        monthlyPriceSnapshot: 1500000,
      }),
      save: jest.fn(async (entity, data) =>
        entity === Invoice ? { ...data, id: 'inv-new', invoiceNo: 'INV-NEW' } : data,
      ),
      create: jest.fn((_entity, data) => ({ ...data })),
    };
    notifications = { createForUsers: jest.fn() };
  });

  it('takes a debt the deposit covers from it, without an invoice', async () => {
    const invoice = await run(-500000, '1500000.00');

    expect(invoice).toBeNull();
    expect(depositUpdate()).toEqual(['-500000.00', 'dep-1']);
    expect(savedInvoice()).toBeUndefined();
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({ type: NotificationType.UNIT_CHANGE_RENT_SETTLED }),
    );
  });

  it('bills on the new contract what the deposit cannot cover instead of forgiving it', async () => {
    const invoice = await run(-3000000, '1500000.00');

    expect(depositUpdate()).toEqual(['-1500000.00', 'dep-1']);
    expect(invoice?.id).toBe('inv-new');
    expect(savedInvoice()).toEqual(
      expect.objectContaining({
        contractId: 'contract-new',
        customerId: 'customer-1',
        kind: InvoiceKind.SETTLEMENT,
        total: 1500000,
      }),
    );
    expect(em.save).toHaveBeenCalledWith(InvoiceItem, [
      expect.objectContaining({ itemType: InvoiceItemType.ADJUSTMENT, amount: 1500000 }),
    ]);
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({
        type: NotificationType.INVOICE_ISSUED,
        data: expect.objectContaining({ invoiceId: 'inv-new', contractId: 'contract-new' }),
      }),
    );
  });

  it('bills the whole debt when there is no deposit to take it from', async () => {
    await run(-800000, null);

    expect(depositUpdate()).toBeUndefined();
    expect(savedInvoice()).toEqual(expect.objectContaining({ total: 800000 }));
  });

  it('parks an overpayment in the deposit', async () => {
    const invoice = await run(700000, '1500000.00');

    expect(invoice).toBeNull();
    expect(depositUpdate()).toEqual(['700000.00', 'dep-1']);
    // The parked money raises amount_snapshot too, else held_amount would break deposits_check
    // (held_amount <= amount_snapshot).
    expect(depositSql()).toContain('"amount_snapshot" = "amount_snapshot" + GREATEST');
    expect(savedInvoice()).toBeUndefined();
  });

  it('does nothing when the rent nets to zero', async () => {
    await run(0, '1500000.00');

    expect(em.query).not.toHaveBeenCalled();
    expect(notifications.createForUsers).not.toHaveBeenCalled();
  });
});
