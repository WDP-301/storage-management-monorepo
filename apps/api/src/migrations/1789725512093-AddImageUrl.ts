import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUrl1789725512093 implements MigrationInterface {
  name = 'AddImageUrl1789725512093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "storage_items" DROP CONSTRAINT "FK_storage_items_location"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_storage_items_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_storage_locations_created_at"`);
    await queryRunner.query(`ALTER TABLE "storage_items" ADD "image_url" character varying(500)`);
    await queryRunner.query(
      `CREATE INDEX "IDX_d05620f34fb48706c569f6c6c1" ON "storage_items" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a022addd45d14b78d1ff225af1" ON "storage_items" ("sku") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da3de2fe02ef924a9f262b9445" ON "storage_locations" ("created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_items" ADD CONSTRAINT "FK_134b522a28bf503d51f2b26f2d8" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "storage_items" DROP CONSTRAINT "FK_134b522a28bf503d51f2b26f2d8"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_da3de2fe02ef924a9f262b9445"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a022addd45d14b78d1ff225af1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d05620f34fb48706c569f6c6c1"`);
    await queryRunner.query(`ALTER TABLE "storage_items" DROP COLUMN "image_url"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_storage_locations_created_at" ON "storage_locations" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_storage_items_created_at" ON "storage_items" ("created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_items" ADD CONSTRAINT "FK_storage_items_location" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
