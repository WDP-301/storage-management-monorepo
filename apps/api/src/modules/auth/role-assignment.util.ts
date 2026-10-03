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
