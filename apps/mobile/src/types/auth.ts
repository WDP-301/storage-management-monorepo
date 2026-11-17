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

export type CustomerProfile = {
  user_id: string;
  address_line: string | null;
  ward: string | null;
  province: string | null;
  company_name: string | null;
  tax_code: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type IdentityDocumentInfo = {
  docNumber: string | null;
  fileUrl: string;
};

export type AuthMeDetail = {
  user: AuthUser;
  profile: CustomerProfile | null;
  identityDocument: IdentityDocumentInfo | null;
};

export type UpdateProfileInput = {
  fullName?: string;
  phone?: string;
  addressLine?: string;
  ward?: string;
  province?: string;
  companyName?: string;
  taxCode?: string;
};

export type UpdateProfileResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    status: UserStatus;
  };
  profile: CustomerProfile | null;
  identityDocument: IdentityDocumentInfo | null;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ChangePasswordResponse = {
  message: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  fullName: string;
  phone: string;
};
