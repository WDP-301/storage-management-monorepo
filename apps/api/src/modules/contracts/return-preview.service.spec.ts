import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { addVietnamDays, addVietnamMonths, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, DepositStatus, InspectionType } from '@storage/types';
import { IsNull } from 'typeorm';
import { ReturnPreviewService } from './return-preview.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => `${addVietnamDays(vietnamToday(), days)}T05:00:00.000Z`;
const SAVED = { bankBin: null, bankName: 'Ngân hàng X', accountNo: '1234', accountName: 'LE B' };

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

  it('previews a new request: notice from now under the current rules', async () => {
    const before = Date.now();

    const preview = await service.preview('contract-1', 'customer-1', inDays(20));

    expect(preview).toMatchObject({
      scheduled_day: addVietnamDays(vietnamToday(), 20),
      effective_return_day: addVietnamDays(vietnamToday(), 20),
      notice_days: 20,
      required_notice_days: 30,
      early: true,
      short_notice: true,
      short_notice_deduction: 1500000,
      overstay_days: 0,
      overstay_penalty_per_day: 50000,
      deposit_held: 3000000,
      saved_refund_account: SAVED,
    });
    expect((preview.notice_from as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(em.findOne).toHaveBeenCalledWith(Inspection, {
      where: { contractId: 'contract-1', type: InspectionType.RETURN, finalizedAt: IsNull() },
    });
  });

  it('keeps the open request’s anchor and rules when the day moves later', async () => {
    const anchor = new Date(Date.now() - 40 * DAY_MS);
    openReturn = {
      id: 'return-1',
      scheduledAt: new Date(inDays(10)),
      noticeFrom: anchor,
      returnRules: { noticeDays: 90, penaltyPercent: 200 },
    };

    const preview = await service.preview('contract-1', 'customer-1', inDays(20));

    expect(preview).toMatchObject({
      notice_from: anchor,
      notice_days: 60,
      required_notice_days: 90,
      short_notice: true,
      overstay_penalty_per_day: 100000,
    });
    expect(settings.getReturnNoticeDays).not.toHaveBeenCalled();
  });

  it('restarts the notice from now when the open request moves earlier', async () => {
    const before = Date.now();
    openReturn = {
      id: 'return-1',
      scheduledAt: new Date(inDays(40)),
      noticeFrom: new Date(Date.now() - 40 * DAY_MS),
      returnRules: { noticeDays: 30, penaltyPercent: 100 },
    };

    const preview = await service.preview('contract-1', 'customer-1', inDays(20));

    expect((preview.notice_from as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(preview).toMatchObject({ notice_days: 20, short_notice: true });
  });

  it('counts an older request without an anchor from when it was made', async () => {
    const createdAt = new Date(Date.now() - 15 * DAY_MS);
    openReturn = { id: 'return-1', scheduledAt: new Date(inDays(20)), createdAt, noticeFrom: null };

    await expect(service.preview('contract-1', 'customer-1', inDays(20))).resolves.toMatchObject({
      notice_from: createdAt,
      notice_days: 35,
      short_notice: false,
    });
  });

  describe('rules going live', () => {
    it('charges no short-notice deduction for a request made before the rules went live', async () => {
      settings.getReturnRulesEffectiveAt.mockResolvedValueOnce(new Date(Date.now() + DAY_MS));

      await expect(service.preview('contract-1', 'customer-1', inDays(20))).resolves.toMatchObject({
        early: true,
        notice_days: 20,
        short_notice: false,
        short_notice_deduction: 0,
      });
    });

    it('keeps an open request anchored before go-live free of the deduction', async () => {
      // Anchored 20 days ago, rules live 10 days ago: 25 days of notice, short of the 30 required.
      settings.getReturnRulesEffectiveAt.mockResolvedValueOnce(new Date(Date.now() - 10 * DAY_MS));
      openReturn = {
        id: 'return-1',
        scheduledAt: new Date(inDays(5)),
        noticeFrom: new Date(Date.now() - 20 * DAY_MS),
        returnRules: { noticeDays: 30, penaltyPercent: 100 },
      };

      await expect(service.preview('contract-1', 'customer-1', inDays(5))).resolves.toMatchObject({
        early: true,
        notice_days: 25,
        short_notice: false,
        short_notice_deduction: 0,
      });
    });

    it('deducts one month when the request is made after go-live', async () => {
      settings.getReturnRulesEffectiveAt.mockResolvedValueOnce(new Date(Date.now() - DAY_MS));

      await expect(service.preview('contract-1', 'customer-1', inDays(20))).resolves.toMatchObject({
        short_notice: true,
        short_notice_deduction: 1500000,
      });
    });
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
        short_notice: false,
        short_notice_deduction: 0,
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
        noticeFrom: new Date('2026-10-01T00:00:00.000Z'),
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
