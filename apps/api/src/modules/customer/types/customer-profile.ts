import type { UserStatus } from '@storage/types';
import type { CustomerProfile as CustomerProfileEntity } from '../entities/customer-profile.entity';

/** The `customer_profiles` table row, exposed with its raw column names. */
export interface CustomerProfile {
  user_id: string;
  address_line: string | null;
  /** Ward code (FK → wards.code) */
  ward: string | null;
  /** Province code (FK → provinces.code) */
  province: string | null;
  company_name: string | null;
  tax_code: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
}

/** Maps a `customer_profiles` row to its API representation (snake_case columns). */
export function toCustomerProfile(profile: CustomerProfileEntity): CustomerProfile {
  return {
    user_id: profile.userId,
    address_line: profile.addressLine ?? null,
    ward: profile.ward ?? null,
    province: profile.province ?? null,
    company_name: profile.companyName ?? null,
    tax_code: profile.taxCode ?? null,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    deleted_at: profile.deletedAt ?? null,
  };
}

/** Account summary of the profile owner (`app_users` row). */
export interface CustomerAccount {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: UserStatus;
}

export interface IdentityDocumentInfo {
  docNumber: string | null;
  fileUrl: string;
}

export interface CustomerProfileResponse {
  profile: CustomerProfile | null;
  user: CustomerAccount;
  identityDocument: IdentityDocumentInfo | null;
}

export interface ChangePasswordResponse {
  message: string;
}
