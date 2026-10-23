import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { isGlobalManager } from '@modules/inspection/inspection-access.util';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { type EntityManager, In } from 'typeorm';

/** Global managers work everywhere; staff and facility managers at their assigned facilities. */
export async function worksAtFacility(
  em: EntityManager,
  actor: AuthUser,
  facilityId: string,
): Promise<boolean> {
  if (isGlobalManager(actor)) return true;
  const assignments = await em.find(UserRoleAssignment, {
    where: {
      userId: actor.id,
      role: In([UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF]),
    },
  });
  return activeFacilityIds(assignments).includes(facilityId);
}

export async function assertWorksAtFacility(
  em: EntityManager,
  actor: AuthUser,
  facilityId: string,
): Promise<void> {
  if (!(await worksAtFacility(em, actor, facilityId))) {
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not work at the facility of this warehouse',
      HttpStatus.FORBIDDEN,
    );
  }
}
