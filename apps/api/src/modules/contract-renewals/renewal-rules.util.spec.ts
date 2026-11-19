import type { Contract } from '@entities/contract.entity';
import type { ContractRenewal } from '@entities/contract-renewal.entity';
import { ContractRenewalStatus } from '@storage/types';
import { assertBeforeTermEnd } from './renewal-rules.util';
import { renewalFacts, toRenewalView } from './renewal-view';

// 2026-01-10 12:00 in Vietnam, 12 months: the term ends on 2027-01-10, last day 2027-01-09.
const contract = {
  id: 'contract-1',
  contractNo: 'CT-1',
  effectiveAt: new Date('2026-01-10T05:00:00.000Z'),
  months: 12,
  monthlyPriceSnapshot: '3000000.00',
  bookingItem: { storageUnit: { code: 'A-01', facilityId: 'f-1', facility: { name: 'CN HCM' } } },
} as unknown as Contract;

const renewal = (over: Partial<ContractRenewal> = {}): ContractRenewal =>
  ({
    id: 'renewal-1',
    contractId: 'contract-1',
    customerId: 'customer-1',
    months: 6,
    note: null,
    status: ContractRenewalStatus.PENDING,
    previousMonths: null,
    decisionNote: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date('2026-12-01T00:00:00.000Z'),
    contract,
    customer: { id: 'customer-1', fullName: 'Nguyễn Văn A', phone: '0900000000' },
    ...over,
  }) as unknown as ContractRenewal;

describe('assertBeforeTermEnd', () => {
  it('accepts a request up to the last day of the term', () => {
    // 23:59 on 2027-01-09 in Vietnam.
    expect(() => assertBeforeTermEnd(contract, new Date('2027-01-09T16:59:00.000Z'))).not.toThrow();
  });

  it('refuses from the term end day on', () => {
    expect(() => assertBeforeTermEnd(contract, new Date('2027-01-09T17:00:00.000Z'))).toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });
});

describe('renewal view', () => {
  it('shows a pending request against the current term', () => {
    const view = toRenewalView(renewal());

    expect(view).toMatchObject({
      unit_code: 'A-01',
      facility_name: 'CN HCM',
      months: 6,
      term_months: 12,
      term_end_at: '2027-01-09T17:00:00.000Z',
      new_term_end_at: '2027-07-09T17:00:00.000Z',
      monthly_price: 3_000_000,
      customer: { full_name: 'Nguyễn Văn A', phone: '0900000000' },
    });
  });

  it('keeps the replaced term once approved, though the contract has grown', () => {
    const approved = renewal({
      status: ContractRenewalStatus.APPROVED,
      previousMonths: 12,
      contract: { ...contract, months: 18 } as Contract,
    });

    expect(toRenewalView(approved)).toMatchObject({
      term_months: 12,
      new_term_end_at: '2027-07-09T17:00:00.000Z',
    });
    expect(renewalFacts(approved).newTermEndAt.toISOString()).toBe('2027-07-09T17:00:00.000Z');
  });
});
