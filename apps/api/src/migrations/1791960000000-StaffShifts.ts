import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who works which shift on which day. `start_at`/`end_at` are a snapshot of the template's times
 * for that date, so later template edits leave existing shifts alone, and the exclusion
 * constraint can refuse two overlapping shifts of one staff member (cancelled ones excluded).
 * The application checks the same rule first to report which shifts clash; the constraint only
 * guards against concurrent writes. `btree_gist` was created by an earlier migration.
 * That the staff member works at `facility_id` lives in user_role_assignments, so the
 * application enforces it.
 */
export class StaffShifts1791960000000 implements MigrationInterface {
  name = 'StaffShifts1791960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);
    await queryRunner.query(
      `CREATE TABLE "staff_shifts" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "staff_id" uuid NOT NULL,
         "facility_id" uuid NOT NULL,
         "shift_template_id" uuid NOT NULL,
         "work_date" date NOT NULL,
         "start_at" timestamp with time zone NOT NULL,
         "end_at" timestamp with time zone NOT NULL,
         "status" varchar(20) NOT NULL DEFAULT 'SCHEDULED',
         "check_in_at" timestamp with time zone,
         "check_out_at" timestamp with time zone,
         "note" text,
         "assigned_by" uuid,
         "created_at" timestamp with time zone NOT NULL DEFAULT now(),
         "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
         CONSTRAINT "PK_staff_shifts" PRIMARY KEY ("id"),
         CONSTRAINT "CK_staff_shifts_status"
           CHECK ("status" IN ('SCHEDULED', 'CHECKED_IN', 'COMPLETED', 'ABSENT', 'CANCELLED')),
         CONSTRAINT "CK_staff_shifts_period" CHECK ("end_at" > "start_at"),
         CONSTRAINT "CK_staff_shifts_check_out" CHECK ("check_out_at" IS NULL OR "check_in_at" IS NOT NULL),
         CONSTRAINT "FK_staff_shifts_staff" FOREIGN KEY ("staff_id")
           REFERENCES "app_users"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_staff_shifts_facility" FOREIGN KEY ("facility_id")
           REFERENCES "facilities"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_staff_shifts_template" FOREIGN KEY ("shift_template_id")
           REFERENCES "shift_templates"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_staff_shifts_assigned_by" FOREIGN KEY ("assigned_by")
           REFERENCES "app_users"("id") ON DELETE SET NULL,
         CONSTRAINT "EX_staff_shifts_no_overlap" EXCLUDE USING gist (
           "staff_id" WITH =,
           tstzrange("start_at", "end_at") WITH &&
         ) WHERE ("status" <> 'CANCELLED')
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_shifts_facility_date" ON "staff_shifts" ("facility_id", "work_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_shifts_staff_start" ON "staff_shifts" ("staff_id", "start_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "staff_shifts"`);
  }
}
