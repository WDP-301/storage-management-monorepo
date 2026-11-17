import type { ChangePasswordInput, CustomerProfile, UpdateProfileInput } from '../src/types/auth';
import { ApiError } from './api';

export const VIETNAMESE_PHONE_REGEX =
  /^(?:\+?84|0)(?:32|33|34|35|36|37|38|39|52|55|56|58|59|70|76|77|78|79|81|82|83|84|85|86|87|88|89|90|91|92|93|94|96|97|98|99)\d{7}$/;

export type ProfileFormValues = {
  fullName: string;
  phone: string;
  addressLine: string;
  province: string;
  ward: string;
  companyName: string;
  taxCode: string;
};

export type ProfileFieldErrors = Partial<Record<keyof ProfileFormValues, string>>;

export type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordFieldErrors = Partial<Record<keyof PasswordFormValues, string>>;

export function initialProfileValues(
  user: { fullName: string; phone: string | null },
  profile: CustomerProfile | null,
): ProfileFormValues {
  return {
    fullName: user.fullName ?? '',
    phone: user.phone ?? '',
    addressLine: profile?.address_line ?? '',
    province: profile?.province ?? '',
    ward: profile?.ward ?? '',
    companyName: profile?.company_name ?? '',
    taxCode: profile?.tax_code ?? '',
  };
}

export function normalizePhoneInput(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

export function validateProfileForm(
  values: ProfileFormValues,
  options: { includeCustomerFields: boolean },
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  const name = values.fullName.trim();
  if (!name) errors.fullName = 'Vui lòng nhập họ và tên.';
  else if (name.length > 150) errors.fullName = 'Họ và tên tối đa 150 ký tự.';

  const phone = normalizePhoneInput(values.phone);
  if (phone && !VIETNAMESE_PHONE_REGEX.test(phone)) {
    errors.phone = 'Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).';
  }

  if (options.includeCustomerFields) {
    if (values.addressLine.trim().length > 255) {
      errors.addressLine = 'Địa chỉ tối đa 255 ký tự.';
    }
    if (values.ward.trim() && !values.province.trim()) {
      errors.province = 'Vui lòng chọn Tỉnh/Thành phố trước khi chọn Phường/Xã.';
    }
    if (values.companyName.trim().length > 255) {
      errors.companyName = 'Tên công ty tối đa 255 ký tự.';
    }
    if (values.taxCode.trim().length > 20) {
      errors.taxCode = 'Mã số thuế tối đa 20 ký tự.';
    }
  }
  return errors;
}

export function buildUpdateProfilePayload(
  values: ProfileFormValues,
  options: { includeCustomerFields: boolean },
): UpdateProfileInput {
  const payload: UpdateProfileInput = {
    fullName: values.fullName.trim(),
  };
  const phone = normalizePhoneInput(values.phone);
  if (phone) payload.phone = phone;

  if (options.includeCustomerFields) {
    payload.addressLine = values.addressLine.trim();
    payload.province = values.province.trim();
    payload.ward = values.ward.trim();
    payload.companyName = values.companyName.trim();
    payload.taxCode = values.taxCode.trim();
  }
  return payload;
}

export function validatePasswordForm(values: PasswordFormValues): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};
  if (!values.currentPassword) errors.currentPassword = 'Nhập mật khẩu hiện tại.';
  else if (values.currentPassword.length > 72) errors.currentPassword = 'Mật khẩu tối đa 72 ký tự.';

  if (!values.newPassword) errors.newPassword = 'Nhập mật khẩu mới.';
  else if (values.newPassword.length < 8) errors.newPassword = 'Mật khẩu mới cần ít nhất 8 ký tự.';
  else if (values.newPassword.length > 72) errors.newPassword = 'Mật khẩu tối đa 72 ký tự.';
  else if (values.newPassword === values.currentPassword) {
    errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }

  if (!values.confirmPassword) errors.confirmPassword = 'Nhập lại mật khẩu mới.';
  else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
  }
  return errors;
}

export function toChangePasswordPayload(values: PasswordFormValues): ChangePasswordInput {
  return {
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
    confirmPassword: values.confirmPassword,
  };
}

export function mapAccountError(
  error: unknown,
  fallback: string,
): {
  fieldErrors: Record<string, string>;
  message: string;
} {
  if (!(error instanceof ApiError)) return { fieldErrors: {}, message: fallback };
  const rawFields = error.details?.fields;
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(rawFields)) {
    for (const item of rawFields) {
      if (!item || typeof item !== 'object') continue;
      const { field, code, message } = item as {
        field?: unknown;
        code?: unknown;
        message?: unknown;
      };
      if (typeof field !== 'string') continue;
      if (field === 'currentPassword' && code === 'invalidCredentials') {
        fieldErrors[field] = 'Mật khẩu hiện tại không đúng.';
      } else if (field === 'newPassword' && code === 'isSameAsCurrent') {
        fieldErrors[field] = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
      } else if (field === 'confirmPassword' && code === 'notMatch') {
        fieldErrors[field] = 'Mật khẩu xác nhận không khớp.';
      } else if (field === 'phone') {
        fieldErrors[field] = 'Số điện thoại không đúng định dạng Việt Nam.';
      } else if (field === 'province' && code === 'isNotEmpty') {
        fieldErrors[field] = 'Chọn Tỉnh/Thành phố trước khi chọn Phường/Xã.';
      } else if (field === 'ward' && code === 'notBelongsToProvince') {
        fieldErrors[field] = 'Phường/Xã không thuộc Tỉnh/Thành phố đã chọn.';
      } else if (typeof message === 'string') {
        fieldErrors[field] = message;
      }
    }
  }
  const firstFieldMessage = Object.values(fieldErrors)[0];
  return {
    fieldErrors,
    message: firstFieldMessage ?? error.message ?? fallback,
  };
}
