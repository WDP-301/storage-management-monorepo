import type { ApiError } from '../../lib/api';
import type { Amenity, AmenityInput, AmenityUpdate } from '../../types/amenity';

export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;
export const MAX_NAME = 100;
export const MAX_DESCRIPTION = 500;
export const MAX_SORT_ORDER = 9999;

export interface AmenityFormState {
  code: string;
  name: string;
  description: string;
  sortOrder: string;
}

export const EMPTY_AMENITY_FORM: AmenityFormState = {
  code: '',
  name: '',
  description: '',
  sortOrder: '0',
};

export const toAmenityFormState = (a: Amenity): AmenityFormState => ({
  code: a.code,
  name: a.name,
  description: a.description ?? '',
  sortOrder: String(a.sortOrder),
});

/** Codes are stored upper-case, so typing is normalised instead of rejected. */
export const normalizeCode = (value: string) => value.trim().toUpperCase();

// A blank sort order means "no preference", which the API stores as 0.
const sortOrderOf = (form: AmenityFormState) =>
  form.sortOrder.trim() === '' ? 0 : Number(form.sortOrder);

/** Returns a Vietnamese message for the first problem; the code is only checked when creating. */
export function validateAmenityForm(form: AmenityFormState, isEdit: boolean): string | null {
  if (!isEdit && !CODE_PATTERN.test(normalizeCode(form.code))) {
    return 'Mã tiện ích gồm 2–50 ký tự: chữ cái in hoa, số hoặc dấu gạch dưới, bắt đầu bằng chữ cái.';
  }
  const name = form.name.trim();
  if (!name) return 'Vui lòng nhập tên tiện ích.';
  if (name.length > MAX_NAME) return `Tên tiện ích tối đa ${MAX_NAME} ký tự.`;
  if (form.description.trim().length > MAX_DESCRIPTION) {
    return `Mô tả tối đa ${MAX_DESCRIPTION} ký tự.`;
  }
  const order = sortOrderOf(form);
  if (!Number.isInteger(order) || order < 0 || order > MAX_SORT_ORDER) {
    return `Thứ tự hiển thị phải là số nguyên từ 0 đến ${MAX_SORT_ORDER}.`;
  }
  return null;
}

export function buildAmenityPayload(form: AmenityFormState): AmenityInput {
  const description = form.description.trim();
  return {
    code: normalizeCode(form.code),
    name: form.name.trim(),
    ...(description ? { description } : {}),
    sortOrder: sortOrderOf(form),
  };
}

/** Only the fields that differ from the stored amenity; `code` is immutable and never sent. */
export function buildAmenityPatch(form: AmenityFormState, original: Amenity): AmenityUpdate {
  const patch: AmenityUpdate = {};
  const name = form.name.trim();
  if (name !== original.name) patch.name = name;
  const description = form.description.trim() || null;
  if (description !== original.description) patch.description = description;
  const order = sortOrderOf(form);
  if (order !== original.sortOrder) patch.sortOrder = order;
  return patch;
}

export function describeAmenityError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const { status } = err as ApiError;
  if (status === 409) return 'Mã tiện ích đã tồn tại.';
  if (status === 404) return 'Tiện ích không còn tồn tại. Hãy tải lại danh sách.';
  return err.message || fallback;
}
