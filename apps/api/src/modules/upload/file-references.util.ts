import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { isOwnUpload } from './upload.service';

/**
 * Refuses (409 FILE_IN_USE) to delete an upload that is evidence of a finalized inspection —
 * of the inspection itself or of one of its damages — a contract's signed file or a deposit
 * settlement. Files of inspections still being edited may go: staff replace photos while
 * inspecting. Proof of a hand-recorded payment is kept too.
 */
export async function assertFileKeyUnreferenced(em: EntityManager, fileKey: string): Promise<void> {
  const file = JSON.stringify([{ fileKey }]);
  const damage = JSON.stringify([{ evidence: [{ fileKey }] }]);
  const rows: unknown[] = await em.query(
    `SELECT 1 FROM inspections i
      WHERE i.finalized_at IS NOT NULL AND (i.evidence @> $1::jsonb OR i.damages @> $2::jsonb)
     UNION ALL
     SELECT 1 FROM contracts c WHERE c.documents @> $1::jsonb
     UNION ALL
     SELECT 1 FROM contract_settlements s WHERE s.evidence @> $1::jsonb
     UNION ALL
     SELECT 1 FROM payments p WHERE p.metadata->'evidence' @> $1::jsonb
     LIMIT 1`,
    [file, damage],
  );
  if (rows.length > 0) {
    throw new DomainException(
      ErrorCode.FILE_IN_USE,
      'Tệp đang là chứng cứ của biên bản đã chốt, hợp đồng, quyết toán cọc hoặc khoản thanh toán — không thể xoá',
      HttpStatus.CONFLICT,
      { fileKey },
    );
  }
}

/** Roles that work on every customer's contracts, inspections and tickets. */
const STAFF_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.FACILITY_MANAGER,
  UserRole.FACILITY_STAFF,
];

/**
 * Staff open any upload. Anyone else — a customer, or an account whose staff roles ended — only
 * opens a file they uploaded or one attached to something of theirs: their contracts' signed
 * files, the inspections and settlement of those contracts, their tickets and payments; or a
 * warehouse photo, which is public catalogue content. 403 otherwise, whether or not the key
 * exists. Customers can only attach their own uploads to a ticket, so the ticket clause cannot be
 * used to reach someone else's file.
 */
export async function assertCanReadFile(
  em: EntityManager,
  user: AuthUser,
  fileKey: string,
): Promise<void> {
  if (user.roles?.some((role) => STAFF_ROLES.includes(role))) return;
  if (isOwnUpload(fileKey, user.id)) return;
  const file = JSON.stringify([{ fileKey }]);
  const damage = JSON.stringify([{ evidence: [{ fileKey }] }]);
  const rows: unknown[] = await em.query(
    `SELECT 1 FROM contracts c WHERE c.customer_id = $1 AND c.documents @> $2::jsonb
     UNION ALL
     SELECT 1 FROM inspections i JOIN contracts c ON c.id = i.contract_id
      WHERE c.customer_id = $1 AND (i.evidence @> $2::jsonb OR i.damages @> $3::jsonb)
     UNION ALL
     SELECT 1 FROM contract_settlements s JOIN contracts c ON c.id = s.contract_id
      WHERE c.customer_id = $1 AND s.evidence @> $2::jsonb
     UNION ALL
     SELECT 1 FROM service_tickets t WHERE t.customer_id = $1 AND t.attachments @> $2::jsonb
     UNION ALL
     SELECT 1 FROM payments p WHERE p.customer_id = $1 AND p.metadata->'evidence' @> $2::jsonb
     UNION ALL
     SELECT 1 FROM storage_units u WHERE u.images @> $2::jsonb
     LIMIT 1`,
    [user.id, file, damage],
  );
  if (rows.length === 0) {
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'Bạn không có quyền mở tệp này',
      HttpStatus.FORBIDDEN,
      { fileKey },
    );
  }
}
