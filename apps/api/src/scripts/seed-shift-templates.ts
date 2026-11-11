/**
 * Replaces every `shift_templates` row with the two production shifts (OFFICE 08:00–17:00 and
 * WAREHOUSE 17:00–08:00) in the database in apps/api/.env:
 *   pnpm --filter @storage/api seed:shifts
 * Destructive by design: it clears `staff_shifts` (FK ON DELETE RESTRICT) and `shift_templates`
 * before inserting. `db:reset-demo` reseeds the same shifts too.
 */
import { AppDataSource } from '../data-source';
import { seedShiftTemplates } from './shift-templates-seed';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const count = await AppDataSource.transaction((manager) => seedShiftTemplates(manager));
    console.log(`seed:shifts: cleared staff_shifts + shift_templates, inserted ${count} shifts`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
