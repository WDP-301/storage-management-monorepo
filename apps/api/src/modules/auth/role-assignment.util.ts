import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { UserRole } from '@storage/types';
import { type EntityManager, In } from 'typeorm';

/** The system-wide roles that reconcile transfers, approve settlements and make refunds. */
export const BACK_OFFICE_ROLES: readonly UserRole[] = [UserRole.OPERATIONS_MANAGER, UserRole.ADMIN];

/** An assignment is in effect from `startsAt` until `endsAt` (null `endsAt` = open-ended). */
export function isAssignmentActive(
  assignment: Pick<UserRoleAssignment, 'startsAt' | 'endsAt'>,
  now = Date.now(),
): boolean {
  return (
    assignment.startsAt.getTime() <= now &&
    (!assignment.endsAt || assignment.endsAt.getTime() > now)
  );
}

/** Distinct facility ids covered by the currently active assignments in the list. */
export function activeFacilityIds(
  assignments: Pick<UserRoleAssignment, 'facilityId' | 'startsAt' | 'endsAt'>[],
): string[] {
  return [
    ...new Set(
      assignments
        .filter((assignment) => assignment.facilityId && isAssignmentActive(assignment))
        .map((assignment) => assignment.facilityId as string),
    ),
  ];
}

/**
 * Distinct users holding any of `roles` right now. With `facilityIds` only assignments at those
 * facilities count (facility roles); without, every assignment does (system roles have none).
 */
export async function activeRoleHolderIds(
  em: EntityManager,
  roles: readonly UserRole[],
  facilityIds?: readonly string[],
): Promise<string[]> {
  if (facilityIds?.length === 0) return [];
  const assignments = await em.find(UserRoleAssignment, {
    where: { role: In([...roles]), ...(facilityIds ? { facilityId: In([...facilityIds]) } : {}) },
  });
  return [...new Set(assignments.filter((a) => isAssignmentActive(a)).map((a) => a.userId))];
}
