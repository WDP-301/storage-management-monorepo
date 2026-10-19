import { ShelfLayout, type ShelfPlacement } from '@entities/shelf-layout.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { validateLayout } from '@modules/facilities/layout/layout-rules';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';
import {
  DEMO_SHELF_LAYOUT,
  DEMO_SHELF_STATUS,
  DEMO_SHELF_WAREHOUSE,
  DEMO_SHELF_ZONES,
} from './demo-shelf-warehouse-data';

/**
 * Creates the demo shelf warehouse in `facilityId` with its shelves and floor plan. The plan goes
 * through the same rules as a save from the editor, so a broken edit to the data fails here
 * instead of producing a plan the editor cannot load or re-save.
 */
export async function seedDemoShelfWarehouse(
  manager: EntityManager,
  facilityId: string,
): Promise<{ warehouse: StorageUnit; shelves: number }> {
  const demo = DEMO_SHELF_WAREHOUSE;
  const wards: { province_code: string }[] = await manager.query(
    'SELECT province_code FROM wards WHERE code = $1',
    [demo.wardCode],
  );
  if (!wards.length) throw new Error(`Ward ${demo.wardCode} (${demo.code}) not found`);
  // Shelves carry the building's location, as when they are created through the API.
  const location = {
    facilityId,
    addressLine: demo.addressLine,
    wardCode: demo.wardCode,
    provinceCode: wards[0].province_code,
    latitude: demo.latitude,
    longitude: demo.longitude,
  };

  const warehouse = await manager.save(
    manager.create(StorageUnit, {
      ...location,
      kind: StorageUnitKind.SHELF_WAREHOUSE,
      code: demo.code,
      name: demo.name,
      widthM: demo.widthM,
      lengthM: demo.lengthM,
      heightM: demo.heightM,
      monthlyPrice: 0,
      notes: demo.notes,
      status: StorageUnitStatus.AVAILABLE,
    }),
  );

  const rects = DEMO_SHELF_ZONES.flatMap((zone) => zone.rects);
  const drafts = DEMO_SHELF_ZONES.flatMap((zone) =>
    zone.rects.map((_, index) => {
      const own = `${zone.prefix}-${String(index + 1).padStart(2, '0')}`;
      const override = DEMO_SHELF_STATUS[own];
      return manager.create(StorageUnit, {
        ...location,
        kind: StorageUnitKind.SHELF,
        parentId: warehouse.id,
        code: `${demo.code}-${own}`,
        name: `${demo.name} · Kệ ${own}`,
        widthM: zone.widthM,
        lengthM: zone.lengthM,
        heightM: zone.heightM,
        monthlyPrice: zone.monthlyPrice,
        depositMonths: demo.depositMonths,
        notes: override?.notes,
        status: override?.status ?? StorageUnitStatus.AVAILABLE,
      });
    }),
  );
  const shelves = await manager.save(drafts);

  const placements: ShelfPlacement[] = shelves.map((shelf, index) => ({
    shelfId: shelf.id,
    ...rects[index],
  }));
  const document = { ...DEMO_SHELF_LAYOUT, placements };
  const problems = validateLayout(
    document,
    new Map(shelves.map((shelf) => [shelf.id, { code: shelf.code }])),
  );
  if (problems.length > 0) {
    const listed = problems.map((problem) => `${problem.field} ${problem.message}`).join('; ');
    throw new Error(`Demo floor plan of ${demo.code} is invalid: ${listed}`);
  }
  await manager.save(manager.create(ShelfLayout, { warehouseId: warehouse.id, ...document }));
  return { warehouse, shelves: shelves.length };
}
