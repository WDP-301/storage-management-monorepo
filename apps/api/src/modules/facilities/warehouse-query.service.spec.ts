import type { StorageUnit } from '@entities/storage-unit.entity';
import { FacilityStatus, StorageUnitStatus } from '@storage/types';
import { WarehouseQueryService } from './warehouse-query.service';

const unit = {
  id: 'unit-1',
  facilityId: 'fac-1',
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh HCM', status: FacilityStatus.ACTIVE },
  code: 'HCM-01',
  name: 'Kho 1',
  addressLine: '1 Test',
  latitude: '10.700000',
  longitude: '106.700000',
  widthM: '5.00',
  lengthM: '8.00',
  heightM: '3.00',
  areaM2: '40.00',
  volumeM3: '120.00',
  monthlyPrice: '5000000.00',
  depositMonths: null,
  status: StorageUnitStatus.AVAILABLE,
  images: [
    { fileKey: 'uploads/1-cover.jpg', name: 'cover.jpg', mimeType: 'image/jpeg' },
    { fileKey: 'uploads/2-inside.jpg', name: 'inside.jpg', mimeType: 'image/jpeg', size: 10 },
  ],
} as unknown as StorageUnit;

describe('WarehouseQueryService', () => {
  it('returns photos in stored order, each with a presigned link', async () => {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(unit),
    };
    const units = { createQueryBuilder: jest.fn(() => qb) };
    const settings = { getDepositMonthsFor: jest.fn().mockResolvedValue(2) };
    const uploads = {
      generatePresignedDownloadUrl: jest.fn(async (key: string) => `https://signed/${key}`),
    };
    const service = new WarehouseQueryService(
      units as never,
      {} as never,
      settings as never,
      uploads as never,
    );

    const view = await service.findOne('unit-1');

    expect(view.images).toEqual([
      {
        fileKey: 'uploads/1-cover.jpg',
        name: 'cover.jpg',
        mimeType: 'image/jpeg',
        url: 'https://signed/uploads/1-cover.jpg',
      },
      {
        fileKey: 'uploads/2-inside.jpg',
        name: 'inside.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        url: 'https://signed/uploads/2-inside.jpg',
      },
    ]);
  });
});
