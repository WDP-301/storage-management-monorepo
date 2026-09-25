import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerProfileAndSnapshots1789776000004 implements MigrationInterface {
  name = 'AddCustomerProfileAndSnapshots1789776000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE "customer_profiles" (
        "user_id" uuid PRIMARY KEY, "address_line" varchar(255), "ward" varchar(100), "province" varchar(100),
        "company_name" varchar(255), "tax_code" varchar(20),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
        CONSTRAINT "FK_customer_profile_user" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE
      )`,
      `ALTER TABLE "documents" ADD "doc_number" varchar(50)`,
      `CREATE UNIQUE INDEX "UQ_documents_identity_number" ON "documents" ("doc_number") WHERE "type" = 'IDENTITY' AND "doc_number" IS NOT NULL`,
      `ALTER TABLE "contracts" ADD "customer_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE "invoices" ADD "billing_info" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    ];

    for (const statement of statements) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `DROP INDEX "UQ_documents_identity_number"`,
      `ALTER TABLE "documents" DROP COLUMN "doc_number"`,
      `ALTER TABLE "contracts" DROP COLUMN "customer_snapshot"`,
      `ALTER TABLE "invoices" DROP COLUMN "billing_info"`,
      `DROP TABLE "customer_profiles"`,
    ];

    for (const statement of statements) await queryRunner.query(statement);
  }
}
