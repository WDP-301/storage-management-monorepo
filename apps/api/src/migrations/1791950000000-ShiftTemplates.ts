import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The work shifts the system offers. They are rows an admin manages, not a code enum, so moving
 * from three shifts to four is an insert plus deactivating what no longer applies. A used shift is
 * deactivated (`is_active = false`) rather than deleted, so schedules keep pointing at it. `code`
 * is unique among live rows only, so a soft-deleted template frees its code for reuse.
 * Times are local wall-clock times; an `end_time` at or before `start_time` means the shift runs
 * past midnight, so only an empty shift (equal times) is refused here.
 * Seeds three default shifts; an admin can rename, retime or replace them afterwards.
 */
export class ShiftTemplates1791950000000 implements MigrationInterface {
  name = 'ShiftTemplates1791950000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "shift_templates" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "code" varchar(30) NOT NULL,
         "name" varchar(100) NOT NULL,
         "start_time" time NOT NULL,
         "end_time" time NOT NULL,
         "is_active" boolean NOT NULL DEFAULT true,
         "created_at" timestamp with time zone NOT NULL DEFAULT now(),
         "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
         "deleted_at" timestamp with time zone,
         CONSTRAINT "PK_shift_templates" PRIMARY KEY ("id"),
         CONSTRAINT "CK_shift_templates_code" CHECK ("code" ~ '^[A-Z0-9_]{2,30}$'),
         CONSTRAINT "CK_shift_templates_not_empty" CHECK ("start_time" <> "end_time")
       )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shift_templates_code" ON "shift_templates" ("code") WHERE "deleted_at" IS NULL`,
    );
    // Same name TypeORM derives for AuditWithTimezone's created_at index, so the entity stays in sync.
    await queryRunner.query(
      `CREATE INDEX "IDX_6cec9e0d7394d1021cca5f7658" ON "shift_templates" ("created_at")`,
    );
    await queryRunner.query(
      `INSERT INTO "shift_templates" ("code", "name", "start_time", "end_time") VALUES
         ('MORNING', 'Ca sáng', '06:00', '12:00'),
         ('AFTERNOON', 'Ca chiều', '12:00', '18:00'),
         ('EVENING', 'Ca tối', '18:00', '22:00')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shift_templates"`);
  }
}
