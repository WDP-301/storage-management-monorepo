import { Facility } from '@entities/facility.entity';
import { FacilityStatus } from '@storage/types';
import { FacilityCommandService } from './facility-command.service';

describe('FacilityCommandService', () => {
  let repo: { create: jest.Mock; save: jest.Mock; manager: { transaction: jest.Mock } };
  let manager: { findOne: jest.Mock; save: jest.Mock };
  let service: FacilityCommandService;

  beforeEach(() => {
    manager = {
      findOne: jest.fn().mockResolvedValue({ id: 'fac-1', code: 'CN-HCM', name: 'HCM' }),
      save: jest.fn(async (v) => v),
    };
    repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 'fac-new', ...v })),
      manager: { transaction: jest.fn((work) => work(manager)) },
    };
    service = new FacilityCommandService(repo as never);
  });

  it('creates a facility from code, name and optional region', async () => {
    const created = await service.create({ code: 'CN-HN', name: 'Hà Nội', provinceCode: '01' });

    expect(created).toMatchObject({ id: 'fac-new', code: 'CN-HN', provinceCode: '01' });
  });

  it('maps a duplicate code to 409 and an unknown province to 400', async () => {
    repo.save.mockRejectedValueOnce({ driverError: { code: '23505' } });
    await expect(service.create({ code: 'CN-HN', name: 'x' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONFLICT' },
    });

    repo.save.mockRejectedValueOnce({ driverError: { code: '23503' } });
    await expect(
      service.create({ code: 'CN-X', name: 'x', provinceCode: 'zz' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('locks the facility row and applies only the given fields', async () => {
    const updated = await service.update('fac-1', {
      status: FacilityStatus.INACTIVE,
      provinceCode: null,
    });

    expect(manager.findOne).toHaveBeenCalledWith(Facility, {
      where: { id: 'fac-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(updated).toMatchObject({
      code: 'CN-HCM',
      name: 'HCM',
      status: FacilityStatus.INACTIVE,
      provinceCode: null,
    });
  });

  it('rejects null for required fields and 404s an unknown facility', async () => {
    await expect(service.update('fac-1', { name: null } as never)).rejects.toMatchObject({
      status: 400,
    });

    manager.findOne.mockResolvedValue(null);
    await expect(service.update('fac-x', { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});
