import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageService } from './storage.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve(x)),
});

describe('StorageService', () => {
  let itemRepo: ReturnType<typeof mockRepo>;
  let locationRepo: ReturnType<typeof mockRepo>;
  let service: StorageService;

  beforeEach(() => {
    itemRepo = mockRepo();
    locationRepo = mockRepo();
    service = new StorageService(itemRepo as never, locationRepo as never);
  });

  it('rejects a duplicate location code', async () => {
    locationRepo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.createLocation({ code: 'A1', name: 'Aisle 1' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a duplicate item SKU', async () => {
    itemRepo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.createItem({ sku: 'SKU-1', name: 'Box', quantity: 1 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException for a missing item', async () => {
    itemRepo.findOne.mockResolvedValue(null);
    await expect(service.findItemById('missing-id')).rejects.toThrow(NotFoundException);
  });
});
