import type { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import type { EntityManager } from 'typeorm';

/** Relations every inspection read returns: where the unit is and who inspects it. */
export const INSPECTION_RELATIONS = {
  contract: { bookingItem: { storageUnit: { facility: true } } },
  inspector: true,
} as const;

/**
 * Inspection reads go to customers and staff alike: expose who inspects, not their
 * account (email, phone, OAuth subject, status).
 */
export function withPublicInspector<T extends Inspection | null>(inspection: T): T {
  if (inspection?.inspector) {
    const { id, fullName } = inspection.inspector;
    inspection.inspector = { id, fullName } as AppUser;
  }
  return inspection;
}

/** ADMIN and OPERATIONS_MANAGER act across every facility. */
export function isGlobalManager(actor: AuthUser): boolean {
  return actor.roles.includes(UserRole.ADMIN) || actor.roles.includes(UserRole.OPERATIONS_MANAGER);
}

export async function loadManagedFacilityIds(em: EntityManager, userId: string): Promise<string[]> {
  const assignments = await em.find(UserRoleAssignment, {
    where: { userId, role: UserRole.FACILITY_MANAGER },
  });
  return activeFacilityIds(assignments);
}

/** inspection → contract → booking item → unit → facility. */
export async function loadInspectionFacilityId(
  em: EntityManager,
  inspection: Inspection,
): Promise<string | null> {
  const contract = await em.findOne(Contract, {
    where: { id: inspection.contractId },
    relations: { bookingItem: { storageUnit: true } },
  });
  return contract?.bookingItem?.storageUnit?.facilityId ?? null;
}

/** True for global managers and for facility managers assigned to that facility. */
export async function managesFacility(
  em: EntityManager,
  actor: AuthUser,
  facilityId: string | null | undefined,
): Promise<boolean> {
  if (isGlobalManager(actor)) return true;
  if (!facilityId || !actor.roles.includes(UserRole.FACILITY_MANAGER)) return false;
  return (await loadManagedFacilityIds(em, actor.id)).includes(facilityId);
}

/** True when the actor manages the facility the inspection's unit belongs to. */
export async function managesInspectionFacility(
  em: EntityManager,
  inspection: Inspection,
  actor: AuthUser,
): Promise<boolean> {
  if (isGlobalManager(actor)) return true;
  return managesFacility(em, actor, await loadInspectionFacilityId(em, inspection));
}

/** Writes are open to the assigned inspector and to managers of the unit's facility. */
export async function assertInspectorOrManager(
  em: EntityManager,
  inspection: Inspection,
  actor: AuthUser,
  message: string,
): Promise<void> {
  if (inspection.inspectedBy === actor.id) return;
  if (await managesInspectionFacility(em, inspection, actor)) return;
  throw new DomainException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
}

/** Managers of the unit's facility only (assigning, for instance, is not the inspector's call). */
export async function assertManagesInspection(
  em: EntityManager,
  inspection: Inspection,
  actor: AuthUser,
): Promise<void> {
  if (await managesInspectionFacility(em, inspection, actor)) return;
  throw new DomainException(
    ErrorCode.FORBIDDEN,
    'You do not manage the facility this inspection belongs to',
    HttpStatus.FORBIDDEN,
  );
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
