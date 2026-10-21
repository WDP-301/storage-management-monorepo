import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { recurringRentPeriods } from '@modules/invoices/rent-period-invoice.util';
import { Logger } from '@nestjs/common';
import { fromVietnamDate } from '@shared/utils/calendar.util';
import {
  ContractKind,
  ContractStatus,
  InspectionType,
  InvoiceKind,
  InvoiceStatus,
  NotificationType,
} from '@storage/types';
import {
  applyReturnFinalize,
  issueOwedRentPeriods,
  resolveReturnedOn,
  returnFinalizedNotification,
} from './return-finalize.util';

const NOW = new Date('2027-04-20T05:00:00.000Z'); // 12:00 on 20/04 in Vietnam

const returnInspection = (overrides: Partial<Inspection> = {}): Inspection =>
  ({
    id: 'return-1',
    contractId: 'contract-1',
    type: InspectionType.RETURN,
    createdAt: new Date('2027-04-01T03:00:00.000Z'),
    scheduledAt: new Date('2027-04-10T05:00:00.000Z'),
    ...overrides,
  }) as Inspection;

describe('resolveReturnedOn', () => {
  it('defaults to today in Vietnam', () => {
    // 00:30 on 21/04 in Vietnam.
    expect(resolveReturnedOn(returnInspection(), undefined, new Date('2027-04-20T17:30:00Z'))).toBe(
      '2027-04-21',
    );
  });

  it.each(['2027-04-01', '2027-04-15', '2027-04-20'])('accepts %s', (day) => {
    expect(resolveReturnedOn(returnInspection(), day, NOW)).toBe(day);
  });

  it.each([
    ['before the return was requested', '2027-03-31'],
    ['in the future', '2027-04-21'],
  ])('rejects a day %s', (_label, day) => {
    expect(() => resolveReturnedOn(returnInspection(), day, NOW)).toThrow(
      expect.objectContaining({
        status: 400,
        response: expect.objectContaining({
          details: {
            fields: [expect.objectContaining({ field: 'returnedOn', code: 'outOfRange' })],
          },
        }),
      }),
    );
  });

  it('reads the day the return was requested in Vietnam time', () => {
    // 00:00 on 01/04 in Vietnam, still 31/03 in UTC: the earliest allowed day is 01/04.
    const requestedAtMidnight = returnInspection({ createdAt: new Date('2027-03-31T17:00:00Z') });
    expect(resolveReturnedOn(requestedAtMidnight, '2027-04-01', NOW)).toBe('2027-04-01');
    expect(() => resolveReturnedOn(requestedAtMidnight, '2027-03-31', NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    );

    // One second earlier it is still 31/03 in Vietnam.
    const requestedBefore = returnInspection({ createdAt: new Date('2027-03-31T16:59:59Z') });
    expect(resolveReturnedOn(requestedBefore, '2027-03-31', NOW)).toBe('2027-03-31');
  });

  it('closes the range at today in Vietnam time', () => {
    // 23:59:59 on 20/04 in Vietnam, then 00:00 on 21/04.
    const lastSecond = new Date('2027-04-20T16:59:59Z');
    const nextDay = new Date('2027-04-20T17:00:00Z');

    expect(resolveReturnedOn(returnInspection(), '2027-04-20', lastSecond)).toBe('2027-04-20');
    expect(() => resolveReturnedOn(returnInspection(), '2027-04-21', lastSecond)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(resolveReturnedOn(returnInspection(), '2027-04-21', nextDay)).toBe('2027-04-21');
  });

  it('has no return day for a handover, and refuses one', () => {
    const handover = returnInspection({ type: InspectionType.PRE_HANDOVER });

    expect(resolveReturnedOn(handover, undefined, NOW)).toBeNull();
    expect(() => resolveReturnedOn(handover, '2027-04-20', NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe('applyReturnFinalize', () => {
  const contract = {
    id: 'contract-1',
    contractNo: 'CT-1',
    customerId: 'customer-1',
    bookingItemId: 'item-1',
    status: 'ACTIVE',
  } as Contract;
  let em: { query: jest.Mock; transaction: jest.Mock; findOne: jest.Mock };
  let notifications: { createForUsers: jest.Mock };

  beforeEach(() => {
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('UPDATE invoices')) return [[{ id: 'inv-3', invoiceNo: 'INV-3' }], 1];
        // The contract's ledger row already exists.
        return [{ id: 'deposit-1', contractId: 'contract-1' }];
      }),
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
      findOne: jest.fn().mockResolvedValue({ id: 'unit-1', code: 'A101' }),
    };
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
  });

  afterEach(() => jest.restoreAllMocks());

  const run = (inspection: Inspection, returnedOn: string) =>
    applyReturnFinalize(em as never, {
      inspection,
      contract,
      storageUnitId: 'unit-1',
      returnedOn,
      notifications: notifications as never,
    });

  const voidFrom = () => {
    const call = em.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE invoices'));
    return call?.[1][1];
  };

  it('counts to the actual day when the unit came back after the appointment', async () => {
    const inspection = returnInspection();

    await expect(run(inspection, '2027-04-15')).resolves.toEqual({
      effectiveReturnDay: '2027-04-15',
      // A contract without a billed term owes no further periods.
      issuedInvoices: [],
      voidedInvoices: [{ id: 'inv-3', invoiceNo: 'INV-3' }],
    });
    expect(inspection.returnedOn).toBe('2027-04-15');
    expect(voidFrom()).toEqual(fromVietnamDate('2027-04-15'));
  });

  it('counts to the appointment when the unit came back before it', async () => {
    const inspection = returnInspection({ scheduledAt: new Date('2027-04-25T05:00:00.000Z') });

    await expect(run(inspection, '2027-04-20')).resolves.toMatchObject({
      effectiveReturnDay: '2027-04-25',
    });
    expect(inspection.returnedOn).toBe('2027-04-20');
    expect(voidFrom()).toEqual(fromVietnamDate('2027-04-25'));
  });

  it('records the deposit if it is still missing', async () => {
    await run(returnInspection(), '2027-04-15');

    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('FROM deposits d'), [
      'contract-1',
    ]);
  });

  it('finalizes even when the deposit cannot be recorded', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    em.transaction.mockRejectedValue(new Error('deadlock detected'));

    await expect(run(returnInspection(), '2027-04-15')).resolves.toMatchObject({
      effectiveReturnDay: '2027-04-15',
    });
    expect(notifications.createForUsers).toHaveBeenCalled();
  });

  it('tells the customer, and only the customer, the deposit is being settled', async () => {
    await run(returnInspection(), '2027-04-15');

    expect(em.findOne).toHaveBeenCalledWith(StorageUnit, { where: { id: 'unit-1' } });
    expect(notifications.createForUsers).toHaveBeenCalledWith(em, ['customer-1'], {
      type: NotificationType.RETURN_FINALIZED,
      title: 'Đã chốt biên trả kho',
      body: 'Đã chốt biên trả kho A101; tiền cọc đang được quyết toán',
      data: {
        contractId: 'contract-1',
        contractNo: 'CT-1',
        inspectionId: 'return-1',
        returnedOn: '2027-04-15',
      },
    });
  });
});

describe('returnFinalizedNotification', () => {
  it('names the contract when the unit code is unknown', () => {
    expect(
      returnFinalizedNotification({ id: 'c', contractNo: 'CT-9' }, { id: 'r' }, null, '2027-04-15')
        .body,
    ).toBe('Đã chốt biên trả kho của hợp đồng CT-9; tiền cọc đang được quyết toán');
  });
});

interface InvoiceRow {
  id: string;
  invoiceNo: string;
  contractId: string;
  periodNo: number;
  kind: InvoiceKind;
  status: InvoiceStatus;
  startAt: Date;
  total?: number;
  dueAt?: Date;
}

/**
 * Twelve months from 15/01/2027 at 1.5M a month: period n starts on the 15th, n − 1 months later.
 * The invoices table is kept in memory and answers the issuing look-ups and the void UPDATE the
 * way PostgreSQL would.
 */
describe('rent owed when a return is finalized', () => {
  const contract = {
    id: 'contract-1',
    contractNo: 'CT-1',
    customerId: 'customer-1',
    bookingItemId: 'item-1',
    kind: ContractKind.INITIAL,
    status: ContractStatus.ACTIVE,
    effectiveAt: new Date('2027-01-15T05:00:00.000Z'),
    months: 12,
    monthlyPriceSnapshot: '1500000.00',
  } as unknown as Contract;
  const FINALIZED_AT = new Date('2027-07-01T05:00:00.000Z');
  const periodStart = (periodNo: number, of: Contract = contract) =>
    recurringRentPeriods(of).find((p) => p.periodNo === periodNo)?.startAt as Date;
  let rows: InvoiceRow[];
  let em: Record<string, jest.Mock>;
  let notifications: { createForUsers: jest.Mock };

  const billed = (periodNo: number, over: Partial<InvoiceRow> = {}): InvoiceRow => ({
    id: `inv-${periodNo}`,
    invoiceNo: `INV-${periodNo}`,
    contractId: 'contract-1',
    periodNo,
    kind: InvoiceKind.INITIAL,
    status: InvoiceStatus.PAID,
    startAt: periodNo === 1 ? new Date('2027-01-15T05:00:00.000Z') : periodStart(periodNo),
    ...over,
  });
  const live = (r: InvoiceRow) =>
    r.status !== InvoiceStatus.VOID && r.kind !== InvoiceKind.SETTLEMENT;

  beforeEach(() => {
    notifications = { createForUsers: jest.fn().mockResolvedValue(1) };
    em = {
      findOne: jest.fn(async (entity, { where }) => {
        if (entity === StorageUnit) return { id: 'unit-1', code: 'A101' };
        if (entity !== Invoice) return null;
        return (
          rows.find(
            (r) => r.contractId === where.contractId && r.periodNo === where.periodNo && live(r),
          ) ?? null
        );
      }),
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async (entity, data) => {
        if (entity !== Invoice) return data;
        const row = { ...data, id: `new-${data.periodNo}` };
        rows.push(row);
        return row;
      }),
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (!sql.startsWith('UPDATE invoices')) return [{ id: 'deposit-1' }];
        const from = params[1] as Date;
        const hit = rows.filter(
          (r) =>
            r.contractId === params[0] &&
            r.kind !== InvoiceKind.SETTLEMENT &&
            r.status !== InvoiceStatus.VOID &&
            r.startAt.getTime() >= from.getTime(),
        );
        for (const r of hit) r.status = InvoiceStatus.VOID;
        return [hit.map((r) => ({ id: r.id, invoiceNo: r.invoiceNo })), hit.length];
      }),
    };
    em.transaction = jest.fn((cb: (e: unknown) => unknown) => cb(em));
  });

  const finalize = (scheduledAt: string, returnedOn: string, of: Contract = contract) =>
    applyReturnFinalize(em as never, {
      inspection: returnInspection({
        createdAt: new Date('2027-06-20T03:00:00.000Z'),
        scheduledAt: new Date(scheduledAt),
      }),
      contract: of,
      storageUnitId: 'unit-1',
      returnedOn,
      notifications: notifications as never,
      now: FINALIZED_AT,
    });
  const invoiceNotices = () =>
    notifications.createForUsers.mock.calls.filter(
      ([, , payload]) => payload.type === NotificationType.INVOICE_ISSUED,
    );

  it('bills a period that started between the return and the later appointment', async () => {
    // Billed through June; back on 01/07, appointment 01/08: July (from 15/07) was never billed.
    rows = [1, 2, 3, 4, 5, 6].map((n) => billed(n));

    const result = await finalize('2027-08-01T05:00:00.000Z', '2027-07-01');

    expect(result.effectiveReturnDay).toBe('2027-08-01');
    expect(result.issuedInvoices).toHaveLength(1);
    expect(result.issuedInvoices[0]).toMatchObject({
      contractId: 'contract-1',
      customerId: 'customer-1',
      periodNo: 7,
      kind: InvoiceKind.INITIAL,
      status: InvoiceStatus.ISSUED,
      startAt: periodStart(7),
      dueAt: periodStart(7),
      months: 1,
      subtotal: 1500000,
      taxAmount: 0,
      total: 1500000,
      issuedAt: FINALIZED_AT,
    });
    expect(em.save).toHaveBeenCalledWith(
      InvoiceItem,
      expect.objectContaining({
        storageUnitId: 'unit-1',
        description: 'Tiền thuê kỳ 7 — Kho A101 (HĐ: CT-1)',
        amount: 1500000,
      }),
    );
    expect(invoiceNotices()).toEqual([
      [em, ['customer-1'], expect.objectContaining({ title: 'Hóa đơn tiền thuê kho kỳ 7' })],
    ]);
    // Nothing starts on or after 01/08 yet, and the new invoice is not voided.
    expect(result.voidedInvoices).toEqual([]);
    expect(rows.find((r) => r.periodNo === 7)?.status).toBe(InvoiceStatus.ISSUED);
  });

  it('issues before it voids, so the period just billed survives the void', async () => {
    // August was already billed by the daily run; July was not.
    rows = [
      ...[1, 2, 3, 4, 5, 6].map((n) => billed(n)),
      billed(8, { status: InvoiceStatus.ISSUED }),
    ];

    const result = await finalize('2027-08-01T05:00:00.000Z', '2027-07-01');

    expect(result.issuedInvoices.map((i) => i.periodNo)).toEqual([7]);
    expect(result.voidedInvoices).toEqual([{ id: 'inv-8', invoiceNo: 'INV-8' }]);
    const issueAt = em.save.mock.invocationCallOrder[0];
    const voidCall = em.query.mock.calls.findIndex(([sql]) => sql.startsWith('UPDATE invoices'));
    expect(issueAt).toBeLessThan(em.query.mock.invocationCallOrder[voidCall]);
    expect(rows.filter((r) => r.status !== InvoiceStatus.VOID).map((r) => r.periodNo)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('bills nothing when every period before the return day is invoiced', async () => {
    rows = [1, 2, 3, 4, 5, 6, 7].map((n) => billed(n));

    const result = await finalize('2027-07-20T05:00:00.000Z', '2027-07-20');

    expect(result.issuedInvoices).toEqual([]);
    expect(em.save).not.toHaveBeenCalledWith(Invoice, expect.anything());
    expect(invoiceNotices()).toEqual([]);
  });

  it('re-bills a period whose only invoice was voided, but never counts a settlement invoice', async () => {
    rows = [
      ...[1, 2, 3, 4, 5].map((n) => billed(n)),
      billed(6, { status: InvoiceStatus.VOID }),
      billed(7, { kind: InvoiceKind.SETTLEMENT, status: InvoiceStatus.ISSUED, id: 'fee-7' }),
    ];

    const result = await finalize('2027-08-01T05:00:00.000Z', '2027-07-01');

    expect(result.issuedInvoices.map((i) => i.periodNo)).toEqual([6, 7]);
  });

  it('bills no period past the end of the term on an overstay', async () => {
    // Three months from 15/01: periods 2 (15/02) and 3 (15/03) unbilled; term ends 15/04.
    const short = { ...contract, months: 3 } as Contract;
    rows = [billed(1)];

    const result = await finalize('2027-04-15T05:00:00.000Z', '2027-05-10', short);

    expect(result.effectiveReturnDay).toBe('2027-05-10');
    expect(result.issuedInvoices.map((i) => i.periodNo)).toEqual([2, 3]);
    expect(rows.map((r) => r.periodNo)).toEqual([1, 2, 3]);
  });

  it('bills a missing period only once when run again', async () => {
    rows = [1, 2, 3, 4, 5, 6].map((n) => billed(n));

    const first = await issueOwedRentPeriods(
      em as never,
      contract,
      { id: 'unit-1', code: 'A101' },
      '2027-08-01',
      FINALIZED_AT,
      notifications as never,
    );
    const again = await issueOwedRentPeriods(
      em as never,
      contract,
      { id: 'unit-1', code: 'A101' },
      '2027-08-01',
      FINALIZED_AT,
      notifications as never,
    );

    expect(first.map((i) => i.periodNo)).toEqual([7]);
    expect(again).toEqual([]);
    expect(rows.filter((r) => r.periodNo === 7)).toHaveLength(1);
  });

  it('bills nothing for a one-month or free contract', async () => {
    rows = [billed(1)];

    for (const of of [
      { ...contract, months: 1 },
      { ...contract, monthlyPriceSnapshot: '0.00' },
    ] as unknown as Contract[]) {
      await expect(finalize('2027-08-01T05:00:00.000Z', '2027-07-01', of)).resolves.toMatchObject({
        issuedInvoices: [],
      });
    }
  });
});
