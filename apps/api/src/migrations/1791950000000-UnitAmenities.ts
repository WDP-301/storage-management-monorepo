import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Amenity catalog plus the warehouses equipped with each item. A join table rather than a jsonb
 * column on `storage_units`: "has all of these amenities" becomes an indexed count on the primary
 * key, and the foreign keys keep every row pointing at a real amenity. Amenities are retired via
 * `is_active`, never deleted, hence ON DELETE RESTRICT on the amenity side.
 */
export class UnitAmenities1791950000000 implements MigrationInterface {
  name = 'UnitAmenities1791950000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "amenities" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "code" varchar(50) NOT NULL,
         "name" varchar(100) NOT NULL,
         "description" text,
         "is_active" boolean NOT NULL DEFAULT true,
         "sort_order" integer NOT NULL DEFAULT 0,
         "created_at" timestamp with time zone NOT NULL DEFAULT now(),
         "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
         CONSTRAINT "PK_amenities" PRIMARY KEY ("id"),
         CONSTRAINT "UQ_amenities_code" UNIQUE ("code")
       )`,
    );
    await queryRunner.query(
      `CREATE TABLE "storage_unit_amenities" (
         "storage_unit_id" uuid NOT NULL,
         "amenity_id" uuid NOT NULL,
         "quantity" smallint NOT NULL DEFAULT 1,
         "note" varchar(255),
         CONSTRAINT "PK_storage_unit_amenities" PRIMARY KEY ("storage_unit_id", "amenity_id"),
         CONSTRAINT "CK_storage_unit_amenities_quantity" CHECK ("quantity" BETWEEN 1 AND 99),
         CONSTRAINT "FK_storage_unit_amenities_unit" FOREIGN KEY ("storage_unit_id")
           REFERENCES "storage_units"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_storage_unit_amenities_amenity" FOREIGN KEY ("amenity_id")
           REFERENCES "amenities"("id") ON DELETE RESTRICT
       )`,
    );
  }

  /** The catalog is configuration that admins can re-enter, so reverting simply drops both tables. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "storage_unit_amenities"`);
    await queryRunner.query(`DROP TABLE "amenities"`);
  }
}
