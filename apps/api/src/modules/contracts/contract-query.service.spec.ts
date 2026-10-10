import { Contract } from '@entities/contract.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ContractKind, ContractStatus, InspectionType, UserRole } from '@storage/types';
import type { DataSource, Repository } from 'typeorm';
import { ContractQueryService } from './contract-query.service';

const actor = (...roles: UserRole[]) => ({ id: 'user-1', roles }) as unknown as AuthUser;
const ADMIN = actor(UserRole.ADMIN);
const OPS = actor(UserRole.OPERATIONS_MANAGER);
const MANAGER = actor(UserRole.FACILITY_MANAGER);
const SINCE = new Date('2020-01-01');

const contract = (over: Partial<Contract> = {}) =>
  ({
    id: 'contract-1',
    contractNo: 'CT-1',
    customerId: 'customer-1',
    kind: ContractKind.INITIAL,
    status: ContractStatus.DRAFT,
    effectiveAt: new Date('2026-10-15'),
    months: 6,
    monthlyPriceSnapshot: 3200000,
    termsSnapshot: { note: 'x' },
    documents: [],
    createdAt: new Date('2026-10-10'),
    customerSnapshot: { fullName: 'Khách Demo', phone: '0900000005', email: 'k@example.com' },
    bookingItem: {
      depositSnapshot: 3200000,
      storageUnit: {
        id: 'unit-1',
        code: 'HCM-SG-01',
        facilityId: 'fac-hcm',
        facility: { id: 'fac-hcm', code: 'CN-HCM', name: 'Cơ sở HCM' },
      },
    },
    ...over,
  }) as unknown as Contract;

describe('ContractQueryService', () => {
  let qb: Record<string, jest.Mock>;
  let assignments: { facilityId: string | null; startsAt: Date; endsAt: Date | null }[];
  let inspections: unknown[];
  let service: ContractQueryService;

  beforeEach(() => {
    qb = {} as Record<string, jest.Mock>;
    for (const method of [
      'leftJoinAndSelect',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ]) {
      qb[method] = jest.fn(() => qb);
    }
    qb.getManyAndCount = jest.fn(async () => [[contract()], 1]);
    qb.getOne = jest.fn(async () => contract());
    assignments = [{ facilityId: 'fac-hcm', startsAt: SINCE, endsAt: null }];
    inspections = [];
    const getRepository = jest.fn(() => ({ find: jest.fn(async () => inspections) }));
    const dataSource = {
      manager: { find: jest.fn(async () => assignments), getRepository },
      getRepository,
    };
    service = new ContractQueryService(
      { createQueryBuilder: jest.fn(() => qb) } as unknown as Repository<Contract>,
      dataSource as unknown as DataSource,
    );
  });

  const whereCalls = () => qb.andWhere.mock.calls.map(([sql, params]) => ({ sql, params }));

  it('lists every facility for admin and operations, newest first, paginated', async () => {
    for (const user of [ADMIN, OPS]) {
      qb.andWhere.mockClear();
      const result = await service.list(user, { page: 2, limit: 10 });
      expect(whereCalls()).toEqual([]);
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    }
    expect(qb.orderBy).toHaveBeenCalledWith('contract.createdAt', 'DESC');
    expect(qb.skip).toHaveBeenLastCalledWith(10);
    expect(qb.take).toHaveBeenLastCalledWith(10);
  });

  it('narrows admin to a requested facility', async () => {
    await service.list(ADMIN, { facilityId: 'fac-dn' });
    expect(whereCalls()).toEqual([
      { sql: 'unit.facilityId IN (:...scope)', params: { scope: ['fac-dn'] } },
    ]);
  });

  it('limits a facility manager to the facilities they actively manage', async () => {
    assignments.push(
      { facilityId: 'fac-dn', startsAt: SINCE, endsAt: null },
      { facilityId: 'fac-old', startsAt: SINCE, endsAt: new Date('2021-01-01') },
    );
    await service.list(MANAGER, {});
    expect(whereCalls()).toEqual([
      { sql: 'unit.facilityId IN (:...scope)', params: { scope: ['fac-hcm', 'fac-dn'] } },
    ]);
  });

  it('returns nothing when a manager asks for a facility they do not manage', async () => {
    const result = await service.list(MANAGER, { facilityId: 'fac-hn', page: 1, limit: 20 });
    expect(result).toEqual({
      contracts: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });

  it('filters by status and escapes LIKE wildcards in the search term', async () => {
    await service.list(ADMIN, { status: ContractStatus.ACTIVE, search: '  50%_off  ' });
    const [status, search] = whereCalls();
    expect(status).toEqual({
      sql: 'contract.status = :status',
      params: { status: ContractStatus.ACTIVE },
    });
    expect(search.params).toEqual({ search: '%50\\%\\_off%' });
    for (const field of ['contract.contractNo', 'unit.code', "'fullName'", "'phone'", "'email'"]) {
      expect(search.sql).toContain(field);
    }
  });

  it('returns customer, unit, facility and the handover with its inspector', async () => {
    inspections = [
      {
        id: 'insp-1',
        contractId: 'contract-1',
        type: InspectionType.PRE_HANDOVER,
        inspector: { fullName: 'Võ Kỹ Thuật' },
        evidence: [],
        damages: [],
      },
    ];
    const { contracts } = await service.list(ADMIN, {});
    expect(contracts[0]).toMatchObject({
      id: 'contract-1',
      contract_no: 'CT-1',
      status: ContractStatus.DRAFT,
      deposit: 3200000,
      customer: {
        id: 'customer-1',
        full_name: 'Khách Demo',
        phone: '0900000005',
        email: 'k@example.com',
      },
      unit: { id: 'unit-1', code: 'HCM-SG-01' },
      facility: { id: 'fac-hcm', name: 'Cơ sở HCM' },
      handover: { id: 'insp-1', inspector_name: 'Võ Kỹ Thuật' },
      return: null,
      terms: { note: 'x' },
      documents: [],
    });
  });

  it('shows a contract to its facility manager but not to managers of other facilities', async () => {
    await expect(service.detail('contract-1', MANAGER)).resolves.toMatchObject({
      id: 'contract-1',
    });
    qb.getOne.mockResolvedValueOnce(
      contract({
        bookingItem: { storageUnit: { facilityId: 'fac-hn' } },
      } as unknown as Partial<Contract>),
    );
    await expect(service.detail('contract-1', MANAGER)).rejects.toMatchObject({ status: 403 });
    qb.getOne.mockResolvedValueOnce(
      contract({
        bookingItem: { storageUnit: { facilityId: 'fac-hn' } },
      } as unknown as Partial<Contract>),
    );
    await expect(service.detail('contract-1', ADMIN)).resolves.toMatchObject({
      id: 'contract-1',
    });
  });

  it('returns 404 for a missing or soft-deleted contract', async () => {
    qb.getOne.mockResolvedValueOnce(null);
    await expect(service.detail('gone', ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  describe('staffView', () => {
    const STAFF = { id: 'staff-1', roles: [UserRole.FACILITY_STAFF] } as unknown as AuthUser;
    const handover = (over: Record<string, unknown> = {}) => ({
      id: 'insp-1',
      contractId: 'contract-1',
      type: InspectionType.PRE_HANDOVER,
      inspectedBy: 'staff-1',
      inspector: { fullName: 'Võ Kỹ Thuật' },
      evidence: [],
      damages: [],
      ...over,
    });
    const returned = (over: Record<string, unknown> = {}) =>
      handover({ id: 'insp-2', type: InspectionType.RETURN, ...over });

    it('gives the assigned inspector files, handover and the latest return without terms or email', async () => {
      qb.getOne.mockResolvedValueOnce(
        contract({
          documents: [{ fileKey: 'uploads/a.pdf', name: 'a.pdf', mimeType: 'application/pdf' }],
        }),
      );
      inspections = [handover(), returned({ inspectedBy: 'staff-2' })];

      const record = await service.staffView('contract-1', STAFF);

      expect(record).toMatchObject({
        id: 'contract-1',
        documents: [{ fileKey: 'uploads/a.pdf' }],
        handover: { id: 'insp-1' },
        return: { id: 'insp-2' },
        customer: { id: 'customer-1', full_name: 'Khách Demo', phone: '0900000005' },
        permissions: { documents: true, handover: true, return: false },
      });
      expect(record).not.toHaveProperty('terms');
      expect(record.customer).not.toHaveProperty('email');
    });

    it('lets staff assigned only to the return read the contract but not edit its files', async () => {
      inspections = [handover({ inspectedBy: 'staff-2' }), returned()];
      const record = await service.staffView('contract-1', STAFF);
      expect(record.permissions).toEqual({ documents: false, handover: false, return: true });
    });

    it('lets a facility manager of the unit in, and ADMIN in any facility', async () => {
      await expect(service.staffView('contract-1', MANAGER)).resolves.toMatchObject({
        permissions: { documents: true, handover: false, return: false },
      });
      await expect(service.staffView('contract-1', ADMIN)).resolves.toMatchObject({
        id: 'contract-1',
      });
    });

    it('rejects staff who are not assigned and managers of another facility', async () => {
      inspections = [handover({ inspectedBy: 'staff-2' })];
      await expect(service.staffView('contract-1', STAFF)).rejects.toMatchObject({ status: 403 });
      assignments[0].facilityId = 'fac-hn';
      await expect(service.staffView('contract-1', MANAGER)).rejects.toMatchObject({ status: 403 });
    });

    it('returns 404 for a missing contract', async () => {
      qb.getOne.mockResolvedValueOnce(null);
      await expect(service.staffView('gone', STAFF)).rejects.toMatchObject({ status: 404 });
    });
  });
});
