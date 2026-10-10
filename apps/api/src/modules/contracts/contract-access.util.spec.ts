import type { Contract } from '@entities/contract.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ContractStatus, InspectionType, UserRole } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { computeContractPermissions, resolveContractAccess } from './contract-access.util';

const SINCE = new Date('2020-01-01');
const actor = (id: string, ...roles: UserRole[]) => ({ id, roles }) as unknown as AuthUser;
const STAFF = actor('staff-1', UserRole.FACILITY_STAFF);
const FM = actor('fm-1', UserRole.FACILITY_MANAGER);
const ADMIN = actor('admin-1', UserRole.ADMIN);

const inspection = (type: InspectionType, over: Record<string, unknown> = {}) => ({
  id: `${type}-1`,
  contractId: 'contract-1',
  type,
  inspectedBy: 'staff-1',
  finalizedAt: undefined,
  ...over,
});

describe('computeContractPermissions', () => {
  const open = { handover: inspection(InspectionType.PRE_HANDOVER) as never };

  it.each([
    [ContractStatus.DRAFT, true],
    [ContractStatus.ACTIVE, true],
    [ContractStatus.ENDED, false],
    [ContractStatus.CANCELLED, false],
  ])('manager can edit files of a %s contract: %s', (status, expected) => {
    expect(computeContractPermissions(status, true, {}, 'fm-1').documents).toBe(expected);
  });

  it('lets the handover assignee edit files only while the contract is a DRAFT', () => {
    expect(computeContractPermissions(ContractStatus.DRAFT, false, open, 'staff-1')).toEqual({
      documents: true,
      handover: true,
      return: false,
    });
    expect(
      computeContractPermissions(ContractStatus.ACTIVE, false, open, 'staff-1').documents,
    ).toBe(false);
  });

  it('locks staff out once the handover is finalized', () => {
    const finalized = {
      handover: inspection(InspectionType.PRE_HANDOVER, { finalizedAt: new Date() }) as never,
    };
    expect(computeContractPermissions(ContractStatus.DRAFT, false, finalized, 'staff-1')).toEqual({
      documents: false,
      handover: false,
      return: false,
    });
  });

  it('grants the return only to its assignee or a manager while it is open', () => {
    const inspections = { return: inspection(InspectionType.RETURN) as never };
    expect(
      computeContractPermissions(ContractStatus.ACTIVE, false, inspections, 'staff-1').return,
    ).toBe(true);
    expect(
      computeContractPermissions(ContractStatus.ACTIVE, false, inspections, 'staff-2').return,
    ).toBe(false);
    expect(
      computeContractPermissions(ContractStatus.ACTIVE, true, inspections, 'fm-1').return,
    ).toBe(true);
  });
});

describe('resolveContractAccess', () => {
  const contract = (status: ContractStatus = ContractStatus.DRAFT) =>
    ({
      id: 'contract-1',
      bookingItemId: 'item-1',
      status,
      bookingItem: { storageUnit: { facilityId: 'fac-hcm' } },
    }) as unknown as Contract;

  const build = (inspections: unknown[], managedFacility = 'fac-hcm') =>
    ({
      find: jest.fn(async () => [{ facilityId: managedFacility, startsAt: SINCE, endsAt: null }]),
      findOne: jest.fn(),
      getRepository: jest.fn(() => ({ find: jest.fn(async () => inspections) })),
    }) as unknown as EntityManager;

  it('treats admin and a facility manager of the unit as managers', async () => {
    const em = build([]);
    await expect(resolveContractAccess(em, contract(), ADMIN)).resolves.toMatchObject({
      isManager: true,
      canView: true,
    });
    await expect(resolveContractAccess(em, contract(), FM)).resolves.toMatchObject({
      isManager: true,
      canView: true,
      facilityId: 'fac-hcm',
    });
  });

  it('does not treat a manager of another facility as a manager', async () => {
    const access = await resolveContractAccess(build([], 'fac-hn'), contract(), FM);
    expect(access).toMatchObject({ isManager: false, canView: false });
    expect(access.permissions).toEqual({ documents: false, handover: false, return: false });
  });

  it('lets staff on an open handover view and edit the files of a DRAFT', async () => {
    const access = await resolveContractAccess(
      build([inspection(InspectionType.PRE_HANDOVER)]),
      contract(),
      STAFF,
    );
    expect(access).toMatchObject({ isManager: false, canView: true });
    expect(access.permissions).toEqual({ documents: true, handover: true, return: false });
  });

  it('lets staff with a finalized handover still view but not edit', async () => {
    const access = await resolveContractAccess(
      build([inspection(InspectionType.PRE_HANDOVER, { finalizedAt: new Date() })]),
      contract(ContractStatus.ACTIVE),
      STAFF,
    );
    expect(access.canView).toBe(true);
    expect(access.permissions).toEqual({ documents: false, handover: false, return: false });
  });

  it('lets staff assigned only to the return view it without file or handover rights', async () => {
    const access = await resolveContractAccess(
      build([
        inspection(InspectionType.PRE_HANDOVER, {
          inspectedBy: 'staff-2',
          finalizedAt: new Date(),
        }),
        inspection(InspectionType.RETURN),
      ]),
      contract(ContractStatus.ACTIVE),
      STAFF,
    );
    expect(access.canView).toBe(true);
    expect(access.permissions).toEqual({ documents: false, handover: false, return: true });
  });

  it('hides the contract from staff who are not assigned to it', async () => {
    const access = await resolveContractAccess(
      build([inspection(InspectionType.PRE_HANDOVER, { inspectedBy: 'staff-2' })]),
      contract(),
      STAFF,
    );
    expect(access.canView).toBe(false);
  });

  it('loads the facility from the booking item when the relation is not loaded', async () => {
    const em = build([]);
    (em.findOne as jest.Mock).mockResolvedValue({ storageUnit: { facilityId: 'fac-hcm' } });
    const bare = {
      id: 'contract-1',
      bookingItemId: 'item-1',
      status: ContractStatus.DRAFT,
    } as Contract;
    await expect(resolveContractAccess(em, bare, FM)).resolves.toMatchObject({
      facilityId: 'fac-hcm',
      isManager: true,
    });
  });
});
