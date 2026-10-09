import type { ApiError, FacilityInput, FacilityRecord } from '../../lib/api';

export const NO_REGION = 'none';

export interface FacilityFormState {
  code: string;
  name: string;
  provinceCode: string;
}

export const EMPTY_FACILITY_FORM: FacilityFormState = {
  code: '',
  name: '',
  provinceCode: NO_REGION,
};

export const toFacilityForm = (f: FacilityRecord): FacilityFormState => ({
  code: f.code,
  name: f.name,
  provinceCode: f.provinceCode ?? NO_REGION,
});

export function validateFacilityForm(form: FacilityFormState): string | null {
  const code = form.code.trim();
  const name = form.name.trim();
  if (!code) return 'Vui lòng nhập mã cơ sở.';
  if (code.length > 50) return 'Mã cơ sở tối đa 50 ký tự.';
  if (!name) return 'Vui lòng nhập tên cơ sở.';
  if (name.length > 150) return 'Tên cơ sở tối đa 150 ký tự.';
  return null;
}

export function buildFacilityCreate(form: FacilityFormState): FacilityInput {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    ...(form.provinceCode !== NO_REGION ? { provinceCode: form.provinceCode } : {}),
  };
}

/** Only changed fields; clearing the region is sent as an explicit null. */
export function buildFacilityPatch(
  form: FacilityFormState,
  original: FacilityRecord,
): Partial<FacilityInput> {
  const patch: Partial<FacilityInput> = {};
  if (form.code.trim() !== original.code) patch.code = form.code.trim();
  if (form.name.trim() !== original.name) patch.name = form.name.trim();
  const region = form.provinceCode === NO_REGION ? null : form.provinceCode;
  if (region !== original.provinceCode) patch.provinceCode = region;
  return patch;
}

/** Vietnamese reason for a failed create/update call. */
export function describeFacilityError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const { status } = err as ApiError;
  if (status === 409) return 'Mã cơ sở đã tồn tại. Vui lòng chọn mã khác.';
  if (status === 404) return 'Không tìm thấy cơ sở. Vui lòng làm mới danh sách.';
  if (status === 400 && /province/i.test(err.message)) {
    return 'Tỉnh/thành phố đã chọn không hợp lệ.';
  }
  return fallback;
}
