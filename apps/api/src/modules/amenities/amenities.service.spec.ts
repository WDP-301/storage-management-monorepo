import type { Amenity } from '@entities/amenity.entity';
import { DomainException } from '@shared/exceptions/domain.exception';
import { AmenitiesService } from './amenities.service';

const stored = (overrides: Partial<Amenity> = {}): Amenity =>
  ({
    id: 'am-1',
    code: 'CCTV',
    name: 'Camera',
    description: null,
    isActive: true,
    sortOrder: 0,
    ...overrides,
  }) as Amenity;

describe('AmenitiesService', () => {
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: AmenitiesService;

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 'am-new', ...data })),
    };
    service = new AmenitiesService(repo as never);
  });

  it('lists only active amenities in display order', async () => {
    await service.listActive();

    expect(repo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  });

  it('lists retired amenities too for admins, active ones first', async () => {
    await service.listAll();

    expect(repo.find).toHaveBeenCalledWith({
      order: { isActive: 'DESC', sortOrder: 'ASC', name: 'ASC' },
    });
  });

  it('creates an amenity with defaults and a trimmed name', async () => {
    const created = await service.create({ code: 'LIGHTING', name: '  Đèn  ' });

    expect(created).toMatchObject({
      code: 'LIGHTING',
      name: 'Đèn',
      description: null,
      sortOrder: 0,
    });
  });

  it('answers 409 for a duplicate code', async () => {
    repo.save.mockRejectedValue({ driverError: { code: '23505' } });

    const error = await service.create({ code: 'CCTV', name: 'Camera' }).catch((err) => err);

    expect(error).toBeInstanceOf(DomainException);
    expect(error.getStatus()).toBe(409);
  });

  it('rethrows other database errors', async () => {
    repo.save.mockRejectedValue(new Error('connection lost'));

    await expect(service.create({ code: 'CCTV', name: 'Camera' })).rejects.toThrow(
      'connection lost',
    );
  });

  it('answers 404 when updating a missing amenity', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.update('nope', { name: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('changes only the fields that are present and never the code', async () => {
    repo.findOne.mockResolvedValue(stored({ description: 'old', sortOrder: 5 }));

    const updated = await service.update('am-1', { isActive: false, name: ' Cam ' });

    expect(updated).toMatchObject({
      code: 'CCTV',
      name: 'Cam',
      description: 'old',
      sortOrder: 5,
      isActive: false,
    });
  });

  it('clears the description with null', async () => {
    repo.findOne.mockResolvedValue(stored({ description: 'old' }));

    await expect(service.update('am-1', { description: null })).resolves.toMatchObject({
      description: null,
    });
  });
});
