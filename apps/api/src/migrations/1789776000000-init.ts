import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1789776000000 implements MigrationInterface {
  name = 'Init1789776000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      `CREATE TYPE "public"."storage_items_status_enum" AS ENUM('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "storage_locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" text,
        "address" character varying(255),
        "capacity" integer DEFAULT 1000,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_storage_locations_code" UNIQUE ("code"),
        CONSTRAINT "PK_storage_locations" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_storage_locations_created_at" ON "storage_locations" ("created_at")',
    );
    await queryRunner.query(
      `CREATE TABLE "storage_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sku" character varying(50) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "quantity" integer NOT NULL DEFAULT 0,
        "min_quantity" integer NOT NULL DEFAULT 5,
        "unit" character varying(30) NOT NULL DEFAULT 'pcs',
        "price" numeric(12,2) NOT NULL DEFAULT 0,
        "status" "public"."storage_items_status_enum" NOT NULL DEFAULT 'IN_STOCK',
        "location_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_storage_items_sku" UNIQUE ("sku"),
        CONSTRAINT "PK_storage_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_storage_items_location" FOREIGN KEY ("location_id")
          REFERENCES "storage_locations"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_storage_items_created_at" ON "storage_items" ("created_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "storage_items"');
    await queryRunner.query('DROP TABLE "storage_locations"');
    await queryRunner.query('DROP TYPE "public"."storage_items_status_enum"');
  }
}
