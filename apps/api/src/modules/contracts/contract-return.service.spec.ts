import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { addVietnamDays, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, InspectionType, ReturnRequestSource } from '@storage/types';
import { IsNull } from 'typeorm';
import { ContractReturnService } from './contract-return.service';

/** Noon in Vietnam, `days` from today. */
const inDays = (days: number) => `${addVietnamDays(vietnamToday(), days)}T05:00:00.000Z`;

const ACCOUNT_INPUT = {
  bankBin: '970436',
  bankName: 'VCB',
  accountNo: '0123456789',
  accountName: 'Nguyễn Văn A',
};
const ACCOUNT = {
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '0123456789',
  accountName: 'NGUYEN VAN A',
};
const RULES = { noticeDays: 30, penaltyPercent: 100 };

describe('ContractReturnService', () => {
  let em: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    query: jest.Mock;
  };
  let contract: Partial<Contract> | null;
  /** The open return seen by a new request (no lock). */
  let openReturn: Partial<Inspection> | null;
  /** The latest return, locked by a change or a withdrawal. */
  let latestReturn: Inspection | null;
  let settings: { getReturnNoticeDays: jest.Mock; getOverduePenaltyPercent: jest.Mock };
  let service: ContractReturnService;

  const buildReturn = (overrides: Partial<Inspection> = {}): Inspection =>
    ({
      id: 'return-1',
      contractId: 'contract-1',
      type: InspectionType.RETURN,
      scheduledAt: new Date(inDays(30)),
      noticeFrom: new Date('2026-01-01T00:00:00.000Z'),
      returnRules: { noticeDays: 15, penaltyPercent: 50 },
      requestSource: ReturnRequestSource.CUSTOMER,
      evidence: [],
      damages: [],
      ...overrides,
    }) as Inspection;

  beforeEach(() => {
    contract = { id: 'contract-1', customerId: 'customer-1', status: ContractStatus.ACTIVE };
    openReturn = null;
    latestReturn = buildReturn();
    em = {
      findOne: jest.fn(async (entity, options) => {
        if (entity === Contract) return contract;
        return options.lock ? latestReturn : openReturn;
      }),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, data) => ({ id: 'return-1', ...data })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue([]),
    };
    settings = {
      getReturnNoticeDays: jest.fn().mockResolvedValue(RULES.noticeDays),
      getOverduePenaltyPercent: jest.fn().mockResolvedValue(RULES.penaltyPercent),
    };
    service = new ContractReturnService(
      { transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)) } as never,
      settings as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  const profileWrites = () =>
    em.query.mock.calls.filter(([sql]) => String(sql).includes('customer_profiles'));

  describe('requestReturn', () => {
    const dto = { scheduledAt: inDays(20), note: '  Trả buổi sáng  ' };

    it('opens a RETURN with the notice running from now under the current rules', async () => {
      const before = Date.now();
      const result = await service.requestReturn('contract-1', 'customer-1', {
        ...dto,
        refundAccount: ACCOUNT_INPUT,
      });

      expect(result).toMatchObject({
        id: 'return-1',
        contractId: 'contract-1',
        type: InspectionType.RETURN,
        scheduledAt: new Date(dto.scheduledAt),
        requestNote: 'Trả buổi sáng',
        returnRules: RULES,
        refundAccount: ACCOUNT,
        requestSource: ReturnRequestSource.CUSTOMER,
      });
      expect(result.noticeFrom?.getTime()).toBeGreaterThanOrEqual(before);
      // Who made the request is recorded, but not echoed in the customer's own response.
      expect(em.save.mock.calls[0][1]).toMatchObject({ requestedBy: 'customer-1' });
      expect(result.requestedBy).toBeUndefined();
      expect(em.findOne).toHaveBeenCalledWith(Contract, {
        where: { id: 'contract-1', deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      expect(em.findOne).toHaveBeenCalledWith(Inspection, {
        where: { contractId: 'contract-1', type: InspectionType.RETURN, finalizedAt: IsNull() },
      });
      // Remembered on the profile only to pre-fill the next request.
      expect(profileWrites()).toEqual([
        [expect.any(String), ['customer-1', JSON.stringify(ACCOUNT)]],
      ]);
    });

    it('accepts a request without a refund account, as older app versions send', async () => {
      await expect(service.requestReturn('contract-1', 'customer-1', dto)).resolves.toMatchObject({
        refundAccount: null,
      });
      expect(profileWrites()).toEqual([]);
    });

    it.each([0, 365])('accepts a day %d days from today', async (days) => {
      await expect(
        service.requestReturn('contract-1', 'customer-1', { scheduledAt: inDays(days) }),
      ).resolves.toBeDefined();
    });

    it.each([-1, 366])('rejects a day %d days from today', async (days) => {
      await expect(
        service.requestReturn('contract-1', 'customer-1', { scheduledAt: inDays(days) }),
      ).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'scheduledAt', code: 'outOfRange' }] } },
      });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('counts today in Vietnam time, not server time', async () => {
      // 01:00 on 22/10 in Vietnam, still 21/10 in UTC.
      jest.useFakeTimers({ now: new Date('2026-10-21T18:00:00.000Z'), doNotFake: ['nextTick'] });

      await expect(
        service.requestReturn('contract-1', 'customer-1', {
          scheduledAt: '2026-10-21T12:00:00.000Z',
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.requestReturn('contract-1', 'customer-1', {
          scheduledAt: '2026-10-21T17:30:00.000Z',
        }),
      ).resolves.toBeDefined();
    });

    it('hides another customer’s contract as not found', async () => {
      await expect(service.requestReturn('contract-1', 'customer-2', dto)).rejects.toMatchObject({
        status: 404,
      });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('requires an ACTIVE contract', async () => {
      contract = { ...contract, status: ContractStatus.DRAFT };

      await expect(service.requestReturn('contract-1', 'customer-1', dto)).rejects.toMatchObject({
        status: 409,
        response: {
          code: 'CONFLICT',
          message: 'Chỉ hợp đồng đang thuê mới yêu cầu trả kho được',
        },
      });
    });

    it('rejects a second open return request', async () => {
      openReturn = { id: 'return-0' };

      await expect(service.requestReturn('contract-1', 'customer-1', dto)).rejects.toMatchObject({
        status: 409,
        response: {
          message: 'Hợp đồng đã có yêu cầu trả kho đang mở',
          details: { inspectionId: 'return-0' },
        },
      });
      expect(em.save).not.toHaveBeenCalled();
    });
  });

  describe('updateReturn', () => {
    it('restarts the notice from now when the day moves earlier', async () => {
      const before = Date.now();

      const result = await service.updateReturn('contract-1', 'customer-1', {
        scheduledAt: inDays(10),
      });

      expect(result.scheduledAt).toEqual(new Date(inDays(10)));
      expect(result.noticeFrom?.getTime()).toBeGreaterThanOrEqual(before);
      // The rules captured with the request stay.
      expect(result.returnRules).toEqual({ noticeDays: 15, penaltyPercent: 50 });
    });

    it('captures the current rules when an older request moves earlier', async () => {
      latestReturn = buildReturn({ returnRules: null });

      await expect(
        service.updateReturn('contract-1', 'customer-1', { scheduledAt: inDays(10) }),
      ).resolves.toMatchObject({ returnRules: RULES });
    });

    it.each([
      ['moves later', () => inDays(60)],
      // 22:00 in Vietnam on the appointment day.
      ['keeps its day', () => `${addVietnamDays(vietnamToday(), 30)}T15:00:00.000Z`],
    ])('keeps the notice anchor when the appointment %s', async (_label, scheduledAt) => {
      const result = await service.updateReturn('contract-1', 'customer-1', {
        scheduledAt: scheduledAt(),
      });

      expect(result.noticeFrom).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(settings.getReturnNoticeDays).not.toHaveBeenCalled();
    });

    it('changes the note and the refund account, remembering the account', async () => {
      const result = await service.updateReturn('contract-1', 'customer-1', {
        note: '  Gọi trước  ',
        refundAccount: ACCOUNT_INPUT,
      });

      expect(result).toMatchObject({ requestNote: 'Gọi trước', refundAccount: ACCOUNT });
      expect(result.scheduledAt).toEqual(latestReturn?.scheduledAt);
      expect(profileWrites()).toHaveLength(1);
    });

    it('clears the note with an empty one', async () => {
      latestReturn = buildReturn({ requestNote: 'old' });

      await expect(
        service.updateReturn('contract-1', 'customer-1', { note: '  ' }),
      ).resolves.toMatchObject({ requestNote: null });
    });

    it('locks only the return row, never the contract', async () => {
      await service.updateReturn('contract-1', 'customer-1', { note: 'x' });

      expect(em.findOne).toHaveBeenCalledWith(Contract, {
        where: { id: 'contract-1', deletedAt: IsNull() },
      });
      expect(em.findOne).toHaveBeenCalledWith(Inspection, {
        where: { contractId: 'contract-1', type: InspectionType.RETURN },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('does not show the customer the fees staff proposed', async () => {
      latestReturn = buildReturn({
        damages: [{ description: 'Móp cửa', severity: 'MAJOR', proposedFee: 500000 }],
      });

      const result = await service.updateReturn('contract-1', 'customer-1', { note: 'x' });

      expect(result.damages).toEqual([{ description: 'Móp cửa', severity: 'MAJOR' }]);
    });

    it('rejects a day outside today..+365', async () => {
      await expect(
        service.updateReturn('contract-1', 'customer-1', { scheduledAt: inDays(-1) }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('freezes a finalized return, refund account included', async () => {
      latestReturn = buildReturn({ finalizedAt: new Date('2027-01-01T00:00:00.000Z') });

      await expect(
        service.updateReturn('contract-1', 'customer-1', { refundAccount: ACCOUNT_INPUT }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'RETURN_REQUEST_LOCKED', message: 'Biên trả đã chốt — không sửa được' },
      });
      expect(em.save).not.toHaveBeenCalled();
      expect(profileWrites()).toEqual([]);
    });

    it('accepts the appointment sent back unchanged once its day has passed', async () => {
      // The appointment was two days ago; the form resends it with a new refund account.
      latestReturn = buildReturn({ scheduledAt: new Date(inDays(-2)) });

      await expect(
        service.updateReturn('contract-1', 'customer-1', {
          scheduledAt: `${addVietnamDays(vietnamToday(), -2)}T10:00:00.000Z`,
          refundAccount: ACCOUNT_INPUT,
        }),
      ).resolves.toMatchObject({ refundAccount: ACCOUNT });
    });

    it('still refuses moving a past appointment to another past day', async () => {
      latestReturn = buildReturn({ scheduledAt: new Date(inDays(-2)) });

      await expect(
        service.updateReturn('contract-1', 'customer-1', { scheduledAt: inDays(-1) }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('does not show the customer which staff account made a branch request', async () => {
      latestReturn = buildReturn({
        requestSource: ReturnRequestSource.HOTLINE,
        requestedBy: 'manager-1',
      });

      const result = await service.updateReturn('contract-1', 'customer-1', { note: 'x' });

      expect(result.requestedBy).toBeUndefined();
      expect(result.requestSource).toBe(ReturnRequestSource.HOTLINE);
    });

    it('answers 404 when no return was requested, or for someone else’s contract', async () => {
      latestReturn = null;
      await expect(
        service.updateReturn('contract-1', 'customer-1', { note: 'x' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'RESOURCE_NOT_FOUND' } });

      latestReturn = buildReturn();
      await expect(
        service.updateReturn('contract-1', 'customer-2', { note: 'x' }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('cancelReturn', () => {
    it('deletes the request and answers with its id', async () => {
      await expect(service.cancelReturn('contract-1', 'customer-1')).resolves.toEqual({
        id: 'return-1',
      });
      expect(em.delete).toHaveBeenCalledWith(Inspection, { id: 'return-1' });
    });

    it('withdraws a request the branch made, while staff recorded nothing', async () => {
      latestReturn = buildReturn({
        requestSource: ReturnRequestSource.HOTLINE,
        requestedBy: 'manager-1',
        inspectedBy: 'staff-1',
        conditionNotes: '   ',
      });

      await expect(service.cancelReturn('contract-1', 'customer-1')).resolves.toEqual({
        id: 'return-1',
      });
    });

    it.each([
      ['photos', { evidence: [{ fileKey: 'uploads/1.jpg' }] }],
      ['damages', { damages: [{ description: 'Móp', severity: 'MINOR' }] }],
      ['condition notes', { conditionNotes: 'Sạch sẽ' }],
      ['an inspection time', { inspectedAt: new Date() }],
    ])('is locked once staff recorded %s', async (_label, overrides) => {
      latestReturn = buildReturn(overrides as Partial<Inspection>);

      await expect(service.cancelReturn('contract-1', 'customer-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'RETURN_REQUEST_LOCKED', details: { inspectionId: 'return-1' } },
      });
      expect(em.delete).not.toHaveBeenCalled();
    });

    it('cannot withdraw a finalized return', async () => {
      latestReturn = buildReturn({ finalizedAt: new Date('2027-01-01T00:00:00.000Z') });

      await expect(service.cancelReturn('contract-1', 'customer-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'RETURN_REQUEST_LOCKED', message: 'Biên trả đã chốt — không sửa được' },
      });
      expect(em.delete).not.toHaveBeenCalled();
    });

    it('answers 404 when there is nothing to withdraw', async () => {
      latestReturn = null;

      await expect(service.cancelReturn('contract-1', 'customer-1')).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
