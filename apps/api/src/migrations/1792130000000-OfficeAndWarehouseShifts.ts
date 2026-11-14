import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The three shifts the table was first seeded with — all backfilled to OFFICE by the type column. */
const LEGACY_CODES = `('MORNING', 'AFTERNOON', 'EVENING')`;

/**
 * Brings the shift templates to the two production shifts: administrative hours (OFFICE
 * 08:00–17:00) and the storage duty (WAREHOUSE 17:00–08:00). Customer appointments — receiving,
 * unit-change moves, returns — may only be booked inside OFFICE windows and are assigned to the
 * staff on shift then, so the legacy rows (06:00–22:00, all typed OFFICE) offered evening and
 * early-morning "office" hours.
 *
 * Non-destructive, unlike the `seed:shifts` script: the legacy shifts are deactivated, not
 * deleted, so existing rosters keep pointing at them and still count when appointments are
 * assigned. New rosters use the two production shifts. A database that already has them (seeded
 * through the script) is left as it is.
 */
export class OfficeAndWarehouseShifts1792130000000 implements MigrationInterface {
  name = 'OfficeAndWarehouseShifts1792130000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "shift_templates" ("code", "name", "type", "start_time", "end_time")
      SELECT seed.code, seed.name, seed.type, seed.start_time::time, seed.end_time::time
      FROM (VALUES
        ('OFFICE', 'Ca hành chính', 'OFFICE', '08:00', '17:00'),
        ('WAREHOUSE', 'Ca trực kho', 'WAREHOUSE', '17:00', '08:00')
      ) AS seed (code, name, type, start_time, end_time)
      WHERE NOT EXISTS (
        SELECT 1 FROM "shift_templates" t WHERE t."code" = seed.code AND t."deleted_at" IS NULL
      )`);
    await queryRunner.query(`
      UPDATE "shift_templates" SET "is_active" = false, "updated_at" = now()
      WHERE "code" IN ${LEGACY_CODES} AND "deleted_at" IS NULL AND "is_active" = true`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Only where the legacy shifts exist (this migration swapped them), and never a used shift.
    await queryRunner.query(`
      DELETE FROM "shift_templates" t
      WHERE t."code" IN ('OFFICE', 'WAREHOUSE')
        AND NOT EXISTS (SELECT 1 FROM "staff_shifts" s WHERE s."shift_template_id" = t."id")
        AND EXISTS (
          SELECT 1 FROM "shift_templates" l
          WHERE l."code" IN ${LEGACY_CODES} AND l."deleted_at" IS NULL
        )`);
    await queryRunner.query(`
      UPDATE "shift_templates" SET "is_active" = true, "updated_at" = now()
      WHERE "code" IN ${LEGACY_CODES} AND "deleted_at" IS NULL`);
  }
}
