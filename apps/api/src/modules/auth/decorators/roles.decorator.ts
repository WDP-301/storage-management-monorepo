import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@storage/types';

export const ROLES_KEY = 'roles';

/** Requires the authenticated user to hold at least one of the given roles. Enforced by `RolesGuard`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
