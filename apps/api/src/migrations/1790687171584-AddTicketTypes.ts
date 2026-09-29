import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add `ticket_types` lookup table and switch `service_tickets.type`
 * from a varchar+CHECK enum to a `type_id` FK, so staff can manage
 * ticket categories in the DB instead of code.
 * `service_tickets` is empty at this point, so no data migration needed.
 */
export class AddTicketTypes1790687171584 implements MigrationInterface {
  name = 'AddTicketTypes1790687171584';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ticket_types" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "code" varchar(30) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
      )`,
    );
    await queryRunner.query(
      `INSERT INTO "ticket_types" ("code", "name") VALUES
        ('SUPPORT', 'Customer Support'),
        ('MAINTENANCE', 'Facility Maintenance')`,
    );

    await queryRunner.query(
      `ALTER TABLE "service_tickets" DROP CONSTRAINT "service_tickets_type_check"`,
    );
    await queryRunner.query(`ALTER TABLE "service_tickets" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "service_tickets" ADD "type_id" uuid NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "service_tickets"
       ADD CONSTRAINT "FK_ticket_type" FOREIGN KEY ("type_id") REFERENCES "ticket_types"("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "service_tickets" DROP CONSTRAINT "FK_ticket_type"`);
    await queryRunner.query(`ALTER TABLE "service_tickets" DROP COLUMN "type_id"`);
    await queryRunner.query(
      `ALTER TABLE "service_tickets" ADD "type" varchar(20) NOT NULL DEFAULT 'SUPPORT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_type_check"
       CHECK ("type" IN ('SUPPORT','MAINTENANCE'))`,
    );
    await queryRunner.query(`DROP TABLE "ticket_types"`);
  }
}
