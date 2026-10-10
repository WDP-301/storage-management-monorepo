import { Contract } from '@entities/contract.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Logger } from '@nestjs/common';
import { ContractStatus, InspectionType, UserRole } from '@storage/types';
import { ContractDocumentsService } from './contract-documents.service';
import type { ContractDocumentDto } from './dto/contract-documents.dto';

const SINCE = new Date('2020-01-01');
const actor = (id: string, ...roles: UserRole[]) => ({ id, roles }) as unknown as AuthUser;
const STAFF = actor('staff-1', UserRole.FACILITY_STAFF);
const FM = actor('fm-1', UserRole.FACILITY_MANAGER);
const OPS = actor('ops-1', UserRole.OPERATIONS_MANAGER);

const file = { fileKey: 'uploads/1-a.pdf', name: 'a.pdf', mimeType: 'application/pdf', size: 5 };
const FILES = [file] as ContractDocumentDto[];

describe('ContractDocumentsService.replace', () => {
  let em: { findOne: jest.Mock; find: jest.Mock; update: jest.Mock; getRepository: jest.Mock };
  let contract: Record<string, unknown> | null;
  let inspections: unknown[];
  let managedFacility: string;
  let service: ContractDocumentsService;

  const open = (over: Record<string, unknown> = {}) => ({
    id: 'insp-1',
    contractId: 'contract-1',
    type: InspectionType.PRE_HANDOVER,
    inspectedBy: 'staff-1',
    ...over,
  });

  beforeEach(() => {
    contract = {
      id: 'contract-1',
      contractNo: 'CT-1',
      bookingItemId: 'item-1',
      status: ContractStatus.DRAFT,
      bookingItem: { storageUnit: { facilityId: 'fac-hcm' } },
    };
    inspections = [open()];
    managedFacility = 'fac-hcm';
    em = {
      findOne: jest.fn(async () => contract),
      find: jest.fn(async () => [{ facilityId: managedFacility, startsAt: SINCE, endsAt: null }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      getRepository: jest.fn(() => ({ find: jest.fn(async () => inspections) })),
    };
    const dataSource = { transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)) };
    service = new ContractDocumentsService(dataSource as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('locks the contract row and stores the files for a manager of an ACTIVE contract', async () => {
    contract = { ...contract, status: ContractStatus.ACTIVE };
    const result = await service.replace('contract-1', FILES, OPS);

    expect(em.findOne).toHaveBeenCalledWith(
      Contract,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(em.update).toHaveBeenCalledWith(Contract, { id: 'contract-1' }, { documents: [file] });
    expect(result).toEqual({ id: 'contract-1', status: ContractStatus.ACTIVE, documents: [file] });
  });

  it('lets the facility manager of the unit replace files', async () => {
    await expect(service.replace('contract-1', FILES, FM)).resolves.toMatchObject({
      documents: [file],
    });
  });

  it('lets the assigned handover inspector set files, even an empty list, on a DRAFT', async () => {
    await expect(service.replace('contract-1', FILES, STAFF)).resolves.toBeDefined();
    await expect(service.replace('contract-1', [], STAFF)).resolves.toMatchObject({
      documents: [],
    });
  });

  it('returns 404 for a missing contract', async () => {
    contract = null;
    await expect(service.replace('gone', FILES, OPS)).rejects.toMatchObject({ status: 404 });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects a manager of another facility', async () => {
    managedFacility = 'fac-hn';
    await expect(service.replace('contract-1', FILES, FM)).rejects.toMatchObject({ status: 403 });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('rejects staff on an ACTIVE contract, once locked out', async () => {
    contract = { ...contract, status: ContractStatus.ACTIVE };
    await expect(service.replace('contract-1', FILES, STAFF)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects staff whose handover is finalized or who are not assigned', async () => {
    inspections = [open({ finalizedAt: new Date() })];
    await expect(service.replace('contract-1', FILES, STAFF)).rejects.toMatchObject({
      status: 403,
    });
    inspections = [open({ inspectedBy: 'staff-2' })];
    await expect(service.replace('contract-1', FILES, STAFF)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('answers 403 rather than 409 to a stranger on an ENDED contract', async () => {
    contract = { ...contract, status: ContractStatus.ENDED };
    inspections = [open({ inspectedBy: 'staff-2' })];
    await expect(service.replace('contract-1', FILES, STAFF)).rejects.toMatchObject({
      status: 403,
    });
  });

  it.each([ContractStatus.ENDED, ContractStatus.CANCELLED])(
    'refuses a manager on a %s contract with 409',
    async (status) => {
      contract = { ...contract, status };
      await expect(service.replace('contract-1', FILES, OPS)).rejects.toMatchObject({
        status: 409,
        response: { code: 'CONFLICT' },
      });
      expect(em.update).not.toHaveBeenCalled();
    },
  );

  it('refuses to empty the files of an ACTIVE contract', async () => {
    contract = { ...contract, status: ContractStatus.ACTIVE };
    await expect(service.replace('contract-1', [], OPS)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONTRACT_DOCUMENTS_REQUIRED' },
    });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('lets a manager empty the files of a DRAFT', async () => {
    await expect(service.replace('contract-1', [], OPS)).resolves.toMatchObject({ documents: [] });
  });
});
