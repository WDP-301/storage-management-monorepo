import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import type { EntityManager } from 'typeorm';

/**
 * Refuses (409 FILE_IN_USE) to delete an upload that is evidence of a finalized inspection —
 * of the inspection itself or of one of its damages — or of a deposit settlement. Files of
 * inspections still being edited may go: staff replace photos while inspecting.
 */
export async function assertFileKeyUnreferenced(em: EntityManager, fileKey: string): Promise<void> {
  const file = JSON.stringify([{ fileKey }]);
  const damage = JSON.stringify([{ evidence: [{ fileKey }] }]);
  const rows: unknown[] = await em.query(
    `SELECT 1 FROM inspections i
      WHERE i.finalized_at IS NOT NULL AND (i.evidence @> $1::jsonb OR i.damages @> $2::jsonb)
     UNION ALL
     SELECT 1 FROM contract_settlements s WHERE s.evidence @> $1::jsonb
     LIMIT 1`,
    [file, damage],
  );
  if (rows.length > 0) {
    throw new DomainException(
      ErrorCode.FILE_IN_USE,
      'Tệp đang là chứng cứ của biên bản đã chốt hoặc quyết toán cọc — không thể xoá',
      HttpStatus.CONFLICT,
      { fileKey },
    );
  }
}
