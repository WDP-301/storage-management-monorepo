import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTourAppointments1791400000000 implements MigrationInterface {
  name = 'AddTourAppointments1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tour_appointment_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'ASSIGNED', 'COMPLETED', 'CANCELLED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "tour_appointments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "facility_id" uuid NOT NULL,
        "customer_id" uuid,
        "full_name" character varying(150) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "email" character varying(255) NOT NULL,
        "storage_unit_id" uuid,
        "preferred_date" date NOT NULL,
        "preferred_time_slot" character varying(50),
        "customer_notes" text,
        "status" "public"."tour_appointment_status_enum" NOT NULL DEFAULT 'PENDING',
        "assigned_to" uuid,
        "manager_notes" text,
        "staff_result_notes" text,
        "cancellation_reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_appointments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tour_appointments_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tour_appointments_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tour_appointments_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tour_appointments_assignee" FOREIGN KEY ("assigned_to") REFERENCES "app_users"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      'CREATE INDEX "IDX_tour_appointments_facility_id" ON "tour_appointments" ("facility_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tour_appointments_status" ON "tour_appointments" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tour_appointments_assigned_to" ON "tour_appointments" ("assigned_to")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tour_appointments_created_at" ON "tour_appointments" ("created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_tour_appointments_created_at"');
    await queryRunner.query('DROP INDEX "public"."IDX_tour_appointments_assigned_to"');
    await queryRunner.query('DROP INDEX "public"."IDX_tour_appointments_status"');
    await queryRunner.query('DROP INDEX "public"."IDX_tour_appointments_facility_id"');
    await queryRunner.query('DROP TABLE "tour_appointments"');
    await queryRunner.query('DROP TYPE "public"."tour_appointment_status_enum"');
  }
}
