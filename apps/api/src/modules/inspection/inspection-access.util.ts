import type { Inspection } from '@entities/inspection.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole } from '@storage/types';

/** Writes are open to the assigned inspector and to facility/operations managers. */
export function assertInspectorOrManager(
  inspection: Inspection,
  actor: AuthUser,
  message: string,
): void {
  const isAssignee = inspection.inspectedBy === actor.id;
  const isManager =
    actor.roles.includes(UserRole.FACILITY_MANAGER) ||
    actor.roles.includes(UserRole.OPERATIONS_MANAGER);
  if (!isAssignee && !isManager) {
    throw new DomainException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

/** A finalized inspection is the signed record of the unit's condition — it is read-only. */
export function assertNotFinalized(inspection: Inspection): void {
  if (inspection.finalizedAt) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Inspection is already finalized',
      HttpStatus.CONFLICT,
      { inspectionId: inspection.id, finalizedAt: inspection.finalizedAt.toISOString() },
    );
  }
}
