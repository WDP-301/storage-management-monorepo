import type { UserRole, UserStatus } from '@storage/types';

export type AuthUser = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: UserStatus;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  fullName: string;
  phone: string;
};
