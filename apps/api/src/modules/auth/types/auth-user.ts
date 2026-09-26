import type {
  CustomerProfile,
  IdentityDocumentInfo,
} from '@modules/customer/types/customer-profile';
import type { UserRole, UserStatus } from '@storage/types';

/** Public representation of an authenticated `app_users` record plus its active roles. */
export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  fullName: string;
  status: UserStatus;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUserResponse {
  user: AuthUser;
}

/** `/auth/me` response: the authenticated user plus their customer profile. */
export interface AuthMeResponse {
  user: AuthUser;
  profile: CustomerProfile | null;
  identityDocument: IdentityDocumentInfo | null;
}

export interface LoginResponse {
  expiresAt: string;
}

export interface LogoutResponse {
  loggedOut: boolean;
}

/** Request-derived metadata persisted alongside the session row. */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}
