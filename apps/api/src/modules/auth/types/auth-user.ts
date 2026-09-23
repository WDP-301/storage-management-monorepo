import type { UserRole, UserStatus } from '@shared/models/domain.enums';

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

export interface LoginResponse {
  success: true;
  message: string;
  data: {
    sessionId: string;
    expiresAt: string;
  };
}

export interface LogoutResponse {
  success: true;
  message: string;
}

/** Request-derived metadata persisted alongside the session row. */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}
