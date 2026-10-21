import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import { InspectionType, ReturnRequestSource } from '@storage/types';
import { toCustomerContractRecord, toCustomerInspectionSummary } from './customer-contract';

const ACCOUNT = { bankBin: null, bankName: 'Ngân hàng X', accountNo: '1234', accountName: 'LE B' };

const returnInspection = (overrides: Partial<Inspection> = {}): Inspection =>
  ({
    id: 'return-1',
    type: InspectionType.RETURN,
    scheduledAt: new Date('2027-04-12T05:00:00.000Z'),
    requestNote: 'Trả buổi sáng',
    requestSource: ReturnRequestSource.CUSTOMER,
    requestedBy: 'customer-1',
    refundAccount: ACCOUNT,
    noticeFrom: new Date('2027-03-01T00:00:00.000Z'),
    returnRules: { noticeDays: 30, penaltyPercent: 100 },
    evidence: [],
    damages: [],
    ...overrides,
  }) as Inspection;

describe('toCustomerInspectionSummary', () => {
  it('drops the fee staff proposed for each damage and keeps the rest', () => {
    const damages = [
      { description: 'Móp cửa', severity: 'MAJOR', proposedFee: 500000, evidence: [] },
      { description: 'Trầy sơn', severity: 'MINOR', proposedFee: null },
      { description: 'Bẩn sàn', severity: 'MINOR' },
    ];
    const inspection = returnInspection({ damages: damages as Inspection['damages'] });

    expect(toCustomerInspectionSummary(inspection).damages).toEqual([
      { description: 'Móp cửa', severity: 'MAJOR', evidence: [] },
      { description: 'Trầy sơn', severity: 'MINOR' },
      { description: 'Bẩn sàn', severity: 'MINOR' },
    ]);
    // The stored record keeps the fee for staff.
    expect(inspection.damages?.[0]).toHaveProperty('proposedFee', 500000);
  });

  it('gives no damages when none are recorded', () => {
    expect(toCustomerInspectionSummary(returnInspection({ damages: null })).damages).toEqual([]);
  });

  it.each([
    [ReturnRequestSource.CUSTOMER, ReturnRequestSource.CUSTOMER],
    [ReturnRequestSource.HOTLINE, ReturnRequestSource.HOTLINE],
    [ReturnRequestSource.ABANDONED, ReturnRequestSource.ABANDONED],
    [null, null],
  ])('reports who asked for the return (%s)', (source, expected) => {
    const summary = toCustomerInspectionSummary(returnInspection({ requestSource: source }));

    expect(summary.request_source).toBe(expected);
  });

  it('carries nothing of the settlement bookkeeping', () => {
    const summary = toCustomerInspectionSummary(returnInspection());

    expect(Object.keys(summary).sort()).toEqual([
      'condition_notes',
      'damages',
      'evidence',
      'finalized_at',
      'id',
      'inspected_at',
      'inspector_name',
      'request_note',
      'request_source',
      'scheduled_at',
      'type',
    ]);
  });
});

describe('toCustomerContractRecord', () => {
  it('shows the return and the handover without proposed fees', () => {
    const damaged = (type: InspectionType) =>
      returnInspection({
        id: type,
        type,
        damages: [{ description: 'Móp', severity: 'MAJOR', proposedFee: 100000 }] as never,
      });
    const contract = { id: 'contract-1', contractNo: 'CT-1' } as Contract;

    const record = toCustomerContractRecord(contract, {
      handover: damaged(InspectionType.PRE_HANDOVER),
      return: damaged(InspectionType.RETURN),
    });

    expect(record.handover?.damages).toEqual([{ description: 'Móp', severity: 'MAJOR' }]);
    expect(record.return?.damages).toEqual([{ description: 'Móp', severity: 'MAJOR' }]);
    expect(record.return?.request_source).toBe(ReturnRequestSource.CUSTOMER);
  });
});

describe('toCustomerContractRecord money fields', () => {
  const contract = {
    id: 'contract-1',
    contractNo: 'CT-1',
    effectiveAt: new Date('2027-01-31T10:00:00+07:00'),
    months: 1,
    bookingItem: { depositSnapshot: 900000 },
  } as unknown as Contract;

  it('never guesses the deposit: unknown without the resolved amount', () => {
    const record = toCustomerContractRecord(contract);
    expect(record.deposit).toBeNull();
    expect(record.overdue_penalty_per_day).toBeNull();
    expect(record.settlement).toBeNull();
  });

  it('ends the term on the clamped Vietnam day a month later', () => {
    expect(toCustomerContractRecord(contract).term_end_at).toEqual(
      new Date('2027-02-28T00:00:00+07:00'),
    );
  });

  it('carries the extras it is given', () => {
    const settlement = { status: 'PENDING' } as never;
    const record = toCustomerContractRecord(
      contract,
      {},
      {
        deposit: 0,
        penaltyPerDay: 50000,
        settlement,
      },
    );
    expect(record).toMatchObject({ deposit: 0, overdue_penalty_per_day: 50000, settlement });
  });
});
