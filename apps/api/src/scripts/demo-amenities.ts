import { Amenity } from '@entities/amenity.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { StorageUnitAmenity } from '@entities/storage-unit-amenity.entity';
import { type EntityManager, In } from 'typeorm';
import { DEMO_AMENITIES, DEMO_UNIT_AMENITIES } from './demo-amenities-data';

/** Seeds the amenity catalog and equips the demo warehouses; run after the warehouses exist. */
export async function seedDemoAmenities(manager: EntityManager): Promise<void> {
  const amenities = await manager.save(
    DEMO_AMENITIES.map((demo) => manager.create(Amenity, { ...demo })),
  );
  const amenityIds = new Map(amenities.map((amenity) => [amenity.code, amenity.id]));

  const codes = Object.keys(DEMO_UNIT_AMENITIES);
  const units = await manager.find(StorageUnit, { where: { code: In(codes) } });
  const unitIds = new Map(units.map((unit) => [unit.code, unit.id]));

  const rows = codes.flatMap((unitCode) => {
    const storageUnitId = unitIds.get(unitCode);
    if (!storageUnitId) throw new Error(`Demo warehouse ${unitCode} not found for amenities`);
    return DEMO_UNIT_AMENITIES[unitCode].map(({ amenityCode, quantity }) => {
      const amenityId = amenityIds.get(amenityCode);
      if (!amenityId) throw new Error(`Demo amenity ${amenityCode} is not in the catalog`);
      return manager.create(StorageUnitAmenity, { storageUnitId, amenityId, quantity });
    });
  });
  await manager.save(rows);
}
