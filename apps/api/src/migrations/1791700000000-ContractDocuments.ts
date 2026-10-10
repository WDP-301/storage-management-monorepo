import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the single `contracts.evidence` URL with a `documents` jsonb array of
 * `{ fileKey, name, mimeType, size? }`.
 *
 * up: every legacy URL containing `uploads/<key>` becomes one document. A non-blank
 * evidence value that cannot be converted aborts the migration (and rolls it back) rather
 * than being dropped, so a human decides what to do with it.
 *
 * down is lossy by design: only the first document survives, stored as its file key.
 */
export class ContractDocuments1791700000000 implements MigrationInterface {
  name = 'ContractDocuments1791700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD COLUMN "documents" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `UPDATE "contracts" c
       SET "documents" = jsonb_build_array(jsonb_build_object(
         'fileKey', 'uploads/' || s.k,
         'name', s.k,
         'mimeType', CASE WHEN s.k ~* '\\.pdf$' THEN 'application/pdf' ELSE 'image/jpeg' END
       ))
       FROM (
         SELECT id, substring("evidence" from 'uploads/([^/?#]+)') AS k FROM "contracts"
       ) s
       WHERE s.id = c.id AND s.k IS NOT NULL`,
    );

    const unconverted: { id: string; evidence: string }[] = await queryRunner.query(
      `SELECT "id", "evidence" FROM "contracts"
       WHERE "evidence" IS NOT NULL AND btrim("evidence") <> '' AND "documents" = '[]'::jsonb`,
    );
    if (unconverted.length > 0) {
      const sample = unconverted
        .slice(0, 20)
        .map((row) => `${row.id}: ${row.evidence}`)
        .join('; ');
      throw new Error(
        `Cannot convert ${unconverted.length} contract evidence value(s) without an "uploads/" key; ` +
          `resolve them manually before migrating. ${sample}`,
      );
    }

    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "evidence"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" ADD COLUMN "evidence" text`);
    await queryRunner.query(`UPDATE "contracts" SET "evidence" = "documents" -> 0 ->> 'fileKey'`);
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "documents"`);
  }
}
