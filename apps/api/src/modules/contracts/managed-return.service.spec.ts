import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Logger } from '@nestjs/common';
import { addVietnamDays, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, InspectionType, ReturnRequestSource, UserRole } from '@storage/types';
import { ManagedReturnService } from './managed-return.service';

const inDays = (days: number) => `${addVietnamDays(vietnamToday(), days)}T05:00:00.000Z`;
const actor = (id: string, roles: UserRole[]): AuthUser => ({ id, roles }) as AuthUser;
const MANAGER = actor('manager-1', [UserRole.FACILITY_MANAGER]);

describe('ManagedReturnService.requestOnBehalf', () => {
  let em: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let contract: Partial<Contract> | null;
  let openReturn: Partial<Inspection> | null;
  let service: ManagedReturnService;
  const dto = {
    scheduledAt: inDays(7),
    note: ' Khách gọi hotline ',
    source: ReturnRequestSource.HOTLINE,
  } as const;

  beforeEach(() => {
    contract = {
      id: 'contract-1',
      customerId: 'customer-1',
      bookingItemId: 'item-1',
      status: ContractStatus.ACTIVE,
    };
    openReturn = null;
    em = {
      // manager-1 manages facility-1 only.
      find: jest.fn(async (_entity, { where }) =>
        where.userId === 'manager-1'
          ? [{ facilityId: 'facility-1', startsAt: new Date('2024-01-01T00:00:00Z'), endsAt: null }]
          : [],
      ),
      findOne: jest.fn(async (entity) => {
        if (entity === Contract) return contract;
        if (entity === BookingItem) return { storageUnit: { facilityId: 'facility-1' } };
        if (entity === Inspection) return openReturn;
        return null;
      }),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, data) => ({ id: 'return-1', ...data })),
    };
    const settings = {
      getReturnNoticeDays: jest.fn().mockResolvedValue(30),
      getOverduePenaltyPercent: jest.fn().mockResolvedValue(100),
    };
    service = new ManagedReturnService(
      { transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)) } as never,
      settings as never,
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('records who made the request and why, under the rules in force now', async () => {
    const before = Date.now();
    const result = await service.requestOnBehalf('contract-1', MANAGER, dto);

    expect(result).toMatchObject({
      contractId: 'contract-1',
      type: InspectionType.RETURN,
      scheduledAt: new Date(dto.scheduledAt),
      requestNote: 'Khách gọi hotline',
      requestedBy: 'manager-1',
      requestSource: ReturnRequestSource.HOTLINE,
      returnRules: { noticeDays: 30, penaltyPercent: 100 },
    });
    expect(result.noticeFrom?.getTime()).toBeGreaterThanOrEqual(before);
    expect(em.findOne).toHaveBeenCalledWith(
      Contract,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('keeps the refund account on the request without showing it back to staff', async () => {
    const result = await service.requestOnBehalf(
      'contract-1',
      actor('ops-1', [UserRole.OPERATIONS_MANAGER]),
      {
        ...dto,
        source: ReturnRequestSource.ABANDONED,
        refundAccount: { bankName: 'Ngân hàng X', accountNo: '1234', accountName: 'lê b' },
      },
    );

    const saved = em.save.mock.calls[0][1];
    expect(saved.refundAccount).toEqual({
      bankBin: null,
      bankName: 'Ngân hàng X',
      accountNo: '1234',
      accountName: 'LE B',
    });
    expect(saved.requestSource).toBe(ReturnRequestSource.ABANDONED);
    expect(result.refundAccount).toBeUndefined();
  });

  it.each([
    ['admin', actor('admin-1', [UserRole.ADMIN])],
    ['operations', actor('ops-1', [UserRole.OPERATIONS_MANAGER])],
  ])('lets %s act for any facility', async (_label, who) => {
    await expect(service.requestOnBehalf('contract-1', who, dto)).resolves.toMatchObject({
      requestedBy: who.id,
    });
  });

  it('refuses a facility manager of another facility', async () => {
    await expect(
      service.requestOnBehalf('contract-1', actor('manager-2', [UserRole.FACILITY_MANAGER]), dto),
    ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expect(em.save).not.toHaveBeenCalled();
  });

  it('refuses a facility manager whose assignment to the facility has ended', async () => {
    em.find.mockResolvedValue([
      {
        facilityId: 'facility-1',
        startsAt: new Date('2024-01-01T00:00:00Z'),
        endsAt: new Date('2025-01-01T00:00:00Z'),
      },
    ]);

    await expect(service.requestOnBehalf('contract-1', MANAGER, dto)).rejects.toMatchObject({
      status: 403,
    });
    expect(em.save).not.toHaveBeenCalled();
  });

  it('refuses a facility manager when the unit’s facility is unknown, but not operations', async () => {
    em.findOne.mockImplementation(async (entity) => {
      if (entity === Contract) return contract;
      if (entity === BookingItem) return { storageUnit: null };
      return openReturn;
    });

    await expect(service.requestOnBehalf('contract-1', MANAGER, dto)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.requestOnBehalf('contract-1', actor('ops-1', [UserRole.OPERATIONS_MANAGER]), dto),
    ).resolves.toMatchObject({ requestedBy: 'ops-1' });
  });

  it('tells a facility manager of another facility nothing about the contract’s state', async () => {
    contract = { ...contract, status: ContractStatus.ENDED };
    openReturn = { id: 'return-0' };

    await expect(
      service.requestOnBehalf('contract-1', actor('manager-2', [UserRole.FACILITY_MANAGER]), dto),
    ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
  });

  it('requires an ACTIVE contract', async () => {
    contract = { ...contract, status: ContractStatus.ENDED };

    await expect(service.requestOnBehalf('contract-1', MANAGER, dto)).rejects.toMatchObject({
      status: 409,
      response: { message: 'Chỉ hợp đồng đang thuê mới yêu cầu trả kho được' },
    });
  });

  it('refuses a second open return', async () => {
    openReturn = { id: 'return-0' };

    await expect(service.requestOnBehalf('contract-1', MANAGER, dto)).rejects.toMatchObject({
      status: 409,
      response: { details: { inspectionId: 'return-0' } },
    });
    expect(em.save).not.toHaveBeenCalled();
  });

  it('applies the same day bounds as the customer', async () => {
    await expect(
      service.requestOnBehalf('contract-1', MANAGER, { ...dto, scheduledAt: inDays(366) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown contract', async () => {
    contract = null;

    await expect(service.requestOnBehalf('contract-1', MANAGER, dto)).rejects.toMatchObject({
      status: 404,
    });
  });
});
