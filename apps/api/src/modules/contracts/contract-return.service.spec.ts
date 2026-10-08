import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { ContractStatus, InspectionType } from '@storage/types';
import { IsNull } from 'typeorm';
import { ContractReturnService } from './contract-return.service';

describe('ContractReturnService.requestReturn', () => {
  let em: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let contract: Partial<Contract> | null;
  let openReturn: Partial<Inspection> | null;
  let service: ContractReturnService;
  const dto = { scheduledAt: '2027-04-12T00:00:00.000Z', note: '  Trả buổi sáng  ' };

  beforeEach(() => {
    contract = { id: 'contract-1', customerId: 'customer-1', status: ContractStatus.ACTIVE };
    openReturn = null;
    em = {
      findOne: jest.fn(async (entity) => (entity === Contract ? contract : openReturn)),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, data) => ({ id: 'return-1', ...data })),
    };
    service = new ContractReturnService({
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
    } as never);
  });

  it('opens a RETURN inspection on the requested date with the customer note', async () => {
    await expect(service.requestReturn('contract-1', 'customer-1', dto)).resolves.toEqual({
      id: 'return-1',
      contractId: 'contract-1',
      type: InspectionType.RETURN,
      scheduledAt: new Date('2027-04-12T00:00:00.000Z'),
      conditionNotes: 'Trả buổi sáng',
    });
    expect(em.findOne).toHaveBeenCalledWith(Inspection, {
      where: { contractId: 'contract-1', type: InspectionType.RETURN, finalizedAt: IsNull() },
    });
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
    });
  });

  it('rejects a second open return request', async () => {
    openReturn = { id: 'return-0' };

    await expect(service.requestReturn('contract-1', 'customer-1', dto)).rejects.toMatchObject({
      status: 409,
      response: { details: { inspectionId: 'return-0' } },
    });
    expect(em.save).not.toHaveBeenCalled();
  });
});
