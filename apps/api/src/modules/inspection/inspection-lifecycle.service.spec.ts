import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Logger } from '@nestjs/common';
import { ContractStatus, InspectionType, StorageUnitStatus, UserRole } from '@storage/types';
import { In } from 'typeorm';
import { InspectionLifecycleService } from './inspection-lifecycle.service';

const actor = (id: string, roles: UserRole[] = [UserRole.FACILITY_STAFF]): AuthUser =>
  ({ id, roles }) as AuthUser;

const buildInspection = (overrides: Partial<Inspection> = {}): Inspection =>
  ({
    id: 'insp-1',
    contractId: 'contract-1',
    type: InspectionType.PRE_HANDOVER,
    inspectedBy: 'staff-1',
    evidence: [],
    damages: [],
    ...overrides,
  }) as Inspection;

const buildContract = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 'contract-1',
    contractNo: 'CT-1',
    bookingItemId: 'item-1',
    status: ContractStatus.DRAFT,
    bookingItem: { storageUnit: { facilityId: 'facility-1' } },
    ...overrides,
  }) as unknown as Contract;

describe('InspectionLifecycleService.finalize', () => {
  let em: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
  };
  let service: InspectionLifecycleService;

  const stubRows = (inspection: Inspection, contract: Contract | null = buildContract()) => {
    em.findOne.mockImplementation(async (entity) => {
      if (entity === Inspection) return inspection;
      if (entity === Contract) return contract;
      if (entity === StorageUnit) return { id: 'unit-1', status: StorageUnitStatus.AVAILABLE };
      return null;
    });
  };

  beforeEach(() => {
    em = {
      // Manager-1 manages facility-1 only.
      find: jest.fn(async (_entity, { where }) =>
        where.userId === 'manager-1'
          ? [{ facilityId: 'facility-1', startsAt: new Date('2024-01-01T00:00:00Z'), endsAt: null }]
          : [],
      ),
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'item-1', storageUnitId: 'unit-1' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (_entity, data) => data),
    };
    const dataSource = { transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)) };
    service = new InspectionLifecycleService(dataSource as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('activates the contract, rents the unit and stamps the inspection', async () => {
    stubRows(buildInspection());

    const result = await service.finalize('insp-1', actor('staff-1'));

    expect(em.findOneOrFail).toHaveBeenCalledWith(BookingItem, { where: { id: 'item-1' } });
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1', status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
      { status: StorageUnitStatus.RENTED },
    );
    expect(em.update).toHaveBeenCalledWith(
      Contract,
      { id: 'contract-1' },
      { status: ContractStatus.ACTIVE, signedAt: expect.any(Date) },
    );
    expect(result.finalizedAt).toBeInstanceOf(Date);
    expect(result.inspectedAt).toBe(result.finalizedAt);
  });

  it('keeps an inspectedAt the inspector already recorded', async () => {
    const inspectedAt = new Date('2026-10-12T09:00:00Z');
    stubRows(buildInspection({ inspectedAt }));

    const result = await service.finalize('insp-1', actor('staff-1'));

    expect(result.inspectedAt).toBe(inspectedAt);
  });

  it('lets a facility manager finalize on behalf of the assignee', async () => {
    stubRows(buildInspection());

    await expect(
      service.finalize('insp-1', actor('manager-1', [UserRole.FACILITY_MANAGER])),
    ).resolves.toEqual(expect.objectContaining({ finalizedAt: expect.any(Date) }));
  });

  it('rejects staff who are not the assignee', async () => {
    stubRows(buildInspection());

    await expect(service.finalize('insp-1', actor('staff-2'))).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects a second finalize', async () => {
    stubRows(buildInspection({ finalizedAt: new Date('2026-10-12T09:00:00Z') }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('requires an assigned inspector', async () => {
    stubRows(buildInspection({ inspectedBy: undefined }));

    await expect(
      service.finalize('insp-1', actor('manager-1', [UserRole.FACILITY_MANAGER])),
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
  });

  it('ends the contract and frees the unit on a clean return', async () => {
    stubRows(
      buildInspection({ type: InspectionType.RETURN }),
      buildContract({ status: ContractStatus.ACTIVE }),
    );

    await service.finalize('insp-1', actor('staff-1'));

    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1', status: In([StorageUnitStatus.RENTED]) },
      { status: StorageUnitStatus.AVAILABLE },
    );
    expect(em.update).toHaveBeenCalledWith(
      Contract,
      { id: 'contract-1' },
      { status: ContractStatus.ENDED, endedAt: expect.any(Date) },
    );
  });

  it('sends a damaged unit to maintenance on return', async () => {
    stubRows(
      buildInspection({
        type: InspectionType.RETURN,
        damages: [{ description: 'Móp cửa', severity: 'MAJOR' }],
      }),
      buildContract({ status: ContractStatus.ACTIVE }),
    );

    await service.finalize('insp-1', actor('staff-1'));

    expect(em.update).toHaveBeenCalledWith(StorageUnit, expect.anything(), {
      status: StorageUnitStatus.MAINTENANCE,
    });
  });

  it('rejects a return on a contract that is not ACTIVE', async () => {
    stubRows(buildInspection({ type: InspectionType.RETURN }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('does not finalize MAINTENANCE inspections', async () => {
    stubRows(buildInspection({ type: InspectionType.MAINTENANCE }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
  });

  it('rejects a manager of another facility', async () => {
    stubRows(buildInspection());

    await expect(
      service.finalize('insp-1', actor('manager-2', [UserRole.FACILITY_MANAGER])),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects a contract that is not DRAFT', async () => {
    stubRows(buildInspection(), buildContract({ status: ContractStatus.ACTIVE }));

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects when the unit is no longer reserved, leaving the contract untouched', async () => {
    stubRows(buildInspection());
    em.update.mockResolvedValueOnce({ affected: 0 });

    await expect(service.finalize('insp-1', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(em.update).not.toHaveBeenCalledWith(Contract, expect.anything(), expect.anything());
    expect(em.save).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown inspection', async () => {
    em.findOne.mockResolvedValue(null);

    await expect(service.finalize('missing', actor('staff-1'))).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });
});
