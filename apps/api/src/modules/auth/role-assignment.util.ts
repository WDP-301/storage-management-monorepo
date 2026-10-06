import type { UserRoleAssignment } from '@entities/user-role-assignment.entity';

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
