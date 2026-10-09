import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the BILLING ticket type (payment / deposit issues) and switches the seeded type
 * names to Vietnamese — clients render `ticket_types.name` verbatim to customers.
 */
export class AddBillingTicketType1791620000000 implements MigrationInterface {
  name = 'AddBillingTicketType1791620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "ticket_types" SET "name" = 'Hỗ trợ khách hàng', "updated_at" = now() WHERE "code" = 'SUPPORT'`,
    );
    await queryRunner.query(
      `UPDATE "ticket_types" SET "name" = 'Bảo trì kho', "updated_at" = now() WHERE "code" = 'MAINTENANCE'`,
    );
    await queryRunner.query(
      `INSERT INTO "ticket_types" ("code", "name") VALUES ('BILLING', 'Thanh toán / Đặt cọc')
       ON CONFLICT ("code") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // BILLING tickets fall back to SUPPORT so the type row can be dropped without
    // orphaning them.
    await queryRunner.query(
      `UPDATE "service_tickets" SET "type_id" = (SELECT "id" FROM "ticket_types" WHERE "code" = 'SUPPORT')
       WHERE "type_id" = (SELECT "id" FROM "ticket_types" WHERE "code" = 'BILLING')`,
    );
    await queryRunner.query(`DELETE FROM "ticket_types" WHERE "code" = 'BILLING'`);
    await queryRunner.query(
      `UPDATE "ticket_types" SET "name" = 'Customer Support' WHERE "code" = 'SUPPORT'`,
    );
    await queryRunner.query(
      `UPDATE "ticket_types" SET "name" = 'Facility Maintenance' WHERE "code" = 'MAINTENANCE'`,
    );
  }
}
