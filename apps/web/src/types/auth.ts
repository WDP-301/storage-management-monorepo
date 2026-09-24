export type UserRole =
  | 'SUPER_ADMIN'
  | 'FACILITY_ADMIN'
  | 'FACILITY_STAFF'
  | 'FACILITY_MANAGER'
  | 'CUSTOMER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  fullName: string;
  status: UserStatus;
  roles: UserRole[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

export interface LoginResponse {
  sessionId: string;
  expiresAt: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<AuthUser>;
  register: (data: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}
