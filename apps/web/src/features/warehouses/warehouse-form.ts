import type { Warehouse, WarehouseIdleStatus, WarehouseInput } from '../../types/warehouse';

export const DEPOSIT_DEFAULT = 'default';

export interface WarehouseFormState {
  code: string;
  name: string;
  addressLine: string;
  provinceCode: string;
  wardCode: string;
  latitude: string;
  longitude: string;
  widthM: string;
  lengthM: string;
  heightM: string;
  monthlyPrice: string;
  depositMonths: string;
  notes: string;
  status: WarehouseIdleStatus;
}

export const EMPTY_FORM: WarehouseFormState = {
  code: '',
  name: '',
  addressLine: '',
  provinceCode: '',
  wardCode: '',
  latitude: '',
  longitude: '',
  widthM: '',
  lengthM: '',
  heightM: '',
  monthlyPrice: '',
  depositMonths: DEPOSIT_DEFAULT,
  notes: '',
  status: 'AVAILABLE',
};

export const IDLE_STATUSES: WarehouseIdleStatus[] = ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'];

export const isIdleStatus = (status: string): status is WarehouseIdleStatus =>
  (IDLE_STATUSES as string[]).includes(status);

export const toFormState = (w: Warehouse): WarehouseFormState => ({
  code: w.code,
  name: w.name,
  addressLine: w.addressLine,
  provinceCode: w.provinceCode ?? '',
  wardCode: w.wardCode ?? '',
  latitude: String(w.latitude),
  longitude: String(w.longitude),
  widthM: String(w.widthM),
  lengthM: String(w.lengthM),
  heightM: w.heightM === null ? '' : String(w.heightM),
  monthlyPrice: String(w.monthlyPrice),
  depositMonths: w.depositMonths === null ? DEPOSIT_DEFAULT : String(w.depositMonths),
  notes: w.notes ?? '',
  status: isIdleStatus(w.status) ? w.status : 'AVAILABLE',
});

const num = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

/** Live preview of derived dimensions; null until the inputs are valid numbers. */
export function computeDerived(form: Pick<WarehouseFormState, 'widthM' | 'lengthM' | 'heightM'>) {
  const w = num(form.widthM);
  const l = num(form.lengthM);
  const h = num(form.heightM);
  const area = w > 0 && l > 0 ? w * l : null;
  const volume = area !== null && h > 0 ? area * h : null;
  return { area, volume };
}

/** Validates the form; returns a Vietnamese message for the first problem found. */
export function validateForm(form: WarehouseFormState): string | null {
  if (!form.code.trim()) return 'Vui lòng nhập mã kho.';
  if (!form.name.trim()) return 'Vui lòng nhập tên kho.';
  if (!form.addressLine.trim()) return 'Vui lòng nhập địa chỉ kho.';
  if (!(num(form.widthM) > 0) || !(num(form.lengthM) > 0) || !(num(form.heightM) > 0)) {
    return 'Chiều rộng, dài, cao phải là số lớn hơn 0.';
  }
  const lat = num(form.latitude);
  const lng = num(form.longitude);
  if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) {
    return 'Vui lòng chọn địa chỉ gợi ý hoặc nhập tọa độ hợp lệ.';
  }
  if (!(num(form.monthlyPrice) > 0)) return 'Giá thuê theo tháng phải lớn hơn 0.';
  return null;
}

export function buildPayload(form: WarehouseFormState): WarehouseInput {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    addressLine: form.addressLine.trim(),
    ...(form.provinceCode ? { provinceCode: form.provinceCode } : {}),
    ...(form.wardCode ? { wardCode: form.wardCode } : {}),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    widthM: Number(form.widthM),
    lengthM: Number(form.lengthM),
    heightM: Number(form.heightM),
    monthlyPrice: Number(form.monthlyPrice),
    depositMonths: form.depositMonths === DEPOSIT_DEFAULT ? null : Number(form.depositMonths),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    status: form.status,
  };
}

/** Only the fields that differ from the stored warehouse, so frozen fields are not resent. */
export function buildPatch(form: WarehouseFormState, original: Warehouse): Partial<WarehouseInput> {
  const next = buildPayload(form);
  const before = buildPayload(toFormState(original));
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof WarehouseInput)[]) {
    if (next[key] !== before[key]) patch[key] = next[key];
  }
  if (!form.notes.trim() && original.notes) patch.notes = '';
  // A ward left over from the old province must be cleared explicitly, or the API pairs it
  // with the new province and rejects the mismatch.
  if (!form.wardCode && original.wardCode) patch.wardCode = null;
  if (!isIdleStatus(original.status)) delete patch.status;
  return patch as Partial<WarehouseInput>;
}
