/**
 * Adds the demo shelf warehouse — shelves of seven sizes and a full floor plan — to the database
 * in apps/api/.env without wiping anything (db:reset-demo seeds it too):
 *   pnpm --filter @storage/api seed:shelf-demo
 * Does nothing when a live unit already uses its code, so it is safe to run twice.
 */
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { IsNull } from 'typeorm';
import { AppDataSource } from '../data-source';
import { seedDemoShelfWarehouse } from './demo-shelf-warehouse';
import { DEMO_SHELF_WAREHOUSE } from './demo-shelf-warehouse-data';

async function main(): Promise<void> {
  const { code, facilityCode } = DEMO_SHELF_WAREHOUSE;
  await AppDataSource.initialize();
  try {
    const message = await AppDataSource.transaction(async (manager) => {
      const existing = await manager.findOne(StorageUnit, {
        where: { code, deletedAt: IsNull() },
      });
      if (existing)
        return `seed:shelf-demo: ${code} already exists (${existing.id}), nothing to do`;
      const facility = await manager.findOne(Facility, { where: { code: facilityCode } });
      if (!facility) throw new Error(`Facility ${facilityCode} not found`);
      const { warehouse, shelves } = await seedDemoShelfWarehouse(manager, facility.id);
      return `seed:shelf-demo: created ${code} (${warehouse.id}) with ${shelves} shelves and a floor plan`;
    });
    console.log(message);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
