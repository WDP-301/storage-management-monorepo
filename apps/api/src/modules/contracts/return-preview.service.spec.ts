import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { addVietnamDays, addVietnamMonths, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, DepositStatus, InspectionType } from '@storage/types';
import { IsNull } from 'typeorm';
import { ReturnPreviewService } from './return-preview.service';

const inDays = (days: number) => `${addVietnamDays(vietnamToday(), days)}T05:00:00.000Z`;
const SAVED = { bankBin: '970418', bankName: 'BIDV', accountNo: '1234', accountName: 'LE B' };

describe('ReturnPreviewService.preview', () => {
  let em: { findOne: jest.Mock; query: jest.Mock };
  let contract: Partial<Contract> | null;
  let openReturn: Partial<Inspection> | null;
  let ownDeposits: unknown[];
  let service: ReturnPreviewService;
  const settings = {
    getReturnNoticeDays: jest.fn().mockResolvedValue(30),
    getOverduePenaltyPercent: jest.fn().mockResolvedValue(100),
    getReturnRulesEffectiveAt: jest.fn().mockResolvedValue(new Date('2026-01-01T00:00:00.000Z')),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Six months that started two months ago: a return in 20 days is early.
    contract = {
      id: 'contract-1',
      customerId: 'customer-1',
      bookingItemId: 'item-1',
      status: ContractStatus.ACTIVE,
      effectiveAt: addVietnamMonths(new Date(), -2),
      months: 6,
      monthlyPriceSnapshot: '1500000.00' as never,
    };
    openReturn = null;
    ownDeposits = [
      {
        id: 'deposit-1',
        contractId: 'contract-1',
        paymentId: null,
        amount: '3000000.00',
        heldAmount: '3000000.00',
        status: DepositStatus.HELD,
      },
    ];
    em = {
      findOne: jest.fn(async (entity) => (entity === Contract ? contract : openReturn)),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('customer_profiles')) return [{ account: SAVED }];
        if (sql.includes('d.contract_id = ANY')) return ownDeposits;
        return [];
      }),
    };
    service = new ReturnPreviewService({ manager: em } as never, settings as never);
  });

  it('previews a new request under the current rules: early, so the deposit is forfeited', async () => {
    const preview = await service.preview('contract-1', 'customer-1', inDays(20));

    expect(preview).toMatchObject({
      scheduled_day: addVietnamDays(vietnamToday(), 20),
      effective_return_day: addVietnamDays(vietnamToday(), 20),
      early: true,
      overstay_days: 0,
      overstay_penalty_per_day: 50000,
      deposit_held: 3000000,
      saved_refund_account: SAVED,
    });
    expect(em.findOne).toHaveBeenCalledWith(Inspection, {
      where: { contractId: 'contract-1', type: InspectionType.RETURN, finalizedAt: IsNull() },
    });
  });

  it('keeps the rules the open request captured', async () => {
    openReturn = {
      id: 'return-1',
      scheduledAt: new Date(inDays(10)),
      returnRules: { noticeDays: 90, penaltyPercent: 200 },
    };

    const preview = await service.preview('contract-1', 'customer-1', inDays(20));

    expect(preview).toMatchObject({ early: true, overstay_penalty_per_day: 100000 });
    expect(settings.getReturnNoticeDays).not.toHaveBeenCalled();
  });

  describe('past the end of the term', () => {
    // 21/10/2026 in Vietnam; the term of the contract below ended on 10/10/2026.
    const NOW = new Date('2026-10-21T05:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      contract = {
        ...contract,
        effectiveAt: new Date('2026-04-10T05:00:00.000Z'),
        months: 6,
      };
    });

    afterEach(() => jest.useRealTimers());

    it('charges every day after the term end at the daily rate of the current rules', async () => {
      const preview = await service.preview('contract-1', 'customer-1', '2026-10-25T05:00:00.000Z');

      expect(preview).toMatchObject({
        term_end_at: new Date('2026-10-09T17:00:00.000Z'),
        last_day: '2026-10-09',
        early: false,
        overstay_from_day: '2026-10-10',
        overstay_days: 15,
        overstay_penalty_per_day: 50000,
        overstay_penalty: 750000,
      });
    });

    it('counts overstay from go-live when the rules went live after the term end', async () => {
      settings.getReturnRulesEffectiveAt.mockResolvedValueOnce(
        new Date('2026-10-15T03:00:00.000Z'),
      );

      await expect(
        service.preview('contract-1', 'customer-1', '2026-10-25T05:00:00.000Z'),
      ).resolves.toMatchObject({
        overstay_from_day: '2026-10-15',
        overstay_days: 10,
        overstay_penalty: 500000,
      });
    });

    it('prices a day from the percentage the open request captured, not today’s setting', async () => {
      openReturn = {
        id: 'return-1',
        scheduledAt: new Date('2026-10-22T05:00:00.000Z'),
        returnRules: { noticeDays: 30, penaltyPercent: 150 },
      };

      await expect(
        service.preview('contract-1', 'customer-1', '2026-10-25T05:00:00.000Z'),
      ).resolves.toMatchObject({ overstay_penalty_per_day: 75000, overstay_penalty: 1125000 });
    });

    it('rounds the daily rate half up to the dong', async () => {
      contract = { ...contract, monthlyPriceSnapshot: '1000035.00' as never };

      await expect(
        service.preview('contract-1', 'customer-1', '2026-10-25T05:00:00.000Z'),
      ).resolves.toMatchObject({ overstay_penalty_per_day: 33335, overstay_penalty: 500025 });
    });
  });

  it('reports the deposit as unknown rather than zero', async () => {
    ownDeposits = [];

    await expect(service.preview('contract-1', 'customer-1', inDays(20))).resolves.toMatchObject({
      deposit_held: null,
    });
  });

  it('pre-fills nothing when the customer has no saved account', async () => {
    em.query.mockImplementation(async (sql: string) =>
      sql.includes('d.contract_id = ANY') ? ownDeposits : [],
    );

    await expect(service.preview('contract-1', 'customer-1', inDays(20))).resolves.toMatchObject({
      saved_refund_account: null,
    });
  });

  it('hides another customer’s contract as not found', async () => {
    await expect(service.preview('contract-1', 'customer-2', inDays(20))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('requires an ACTIVE contract', async () => {
    contract = { ...contract, status: ContractStatus.ENDED };

    await expect(service.preview('contract-1', 'customer-1', inDays(20))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('rejects a day outside today..+365', async () => {
    await expect(service.preview('contract-1', 'customer-1', inDays(-1))).rejects.toMatchObject({
      status: 400,
      response: { details: { fields: [{ field: 'scheduledAt' }] } },
    });
    expect(em.findOne).not.toHaveBeenCalled();
  });
});
