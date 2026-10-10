import type {
  Warehouse,
  WarehouseIdleStatus,
  WarehouseImage,
  WarehouseInput,
} from '../../types/warehouse';

export const DEPOSIT_DEFAULT = 'default';

export interface WarehouseFormState {
  facilityId: string;
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
  images: WarehouseImage[];
}

export const EMPTY_FORM: WarehouseFormState = {
  facilityId: '',
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
  images: [],
};

export const IDLE_STATUSES: WarehouseIdleStatus[] = ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'];

export const isIdleStatus = (status: string): status is WarehouseIdleStatus =>
  (IDLE_STATUSES as string[]).includes(status);

export const toFormState = (w: Warehouse): WarehouseFormState => ({
  facilityId: w.facility.id,
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
  images: w.images ?? [],
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

/** Longest side the API accepts, in metres. */
export const MAX_SIDE_M = 1000;
/** Highest monthly rent the API accepts, in VND. */
export const MAX_MONTHLY_PRICE = 100_000_000_000;

const hasAtMostTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const sideProblem = (label: string, value: string): string | null => {
  const n = num(value);
  if (!(n > 0)) return 'Chiều rộng, dài, cao phải là số lớn hơn 0.';
  if (n > MAX_SIDE_M) return `${label} tối đa ${MAX_SIDE_M} m.`;
  if (!hasAtMostTwoDecimals(n)) return `${label} chỉ được tối đa 2 chữ số thập phân.`;
  return null;
};

/**
 * Validates the form; returns a Vietnamese message for the first problem found. A warehouse that
 * is not idle keeps its stored size, so those fields are not checked (the API never receives them).
 */
export function validateForm(form: WarehouseFormState, frozen = false): string | null {
  if (!form.facilityId) return 'Vui lòng chọn cơ sở cho kho.';
  if (!form.code.trim()) return 'Vui lòng nhập mã kho.';
  if (!form.name.trim()) return 'Vui lòng nhập tên kho.';
  if (!form.addressLine.trim()) return 'Vui lòng nhập địa chỉ kho.';
  if (!frozen) {
    const problem =
      sideProblem('Chiều rộng', form.widthM) ??
      sideProblem('Chiều dài', form.lengthM) ??
      sideProblem('Chiều cao', form.heightM);
    if (problem) return problem;
  }
  const lat = num(form.latitude);
  const lng = num(form.longitude);
  if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || (lat === 0 && lng === 0)) {
    return 'Vui lòng chọn địa chỉ gợi ý hoặc nhập tọa độ hợp lệ.';
  }
  const price = num(form.monthlyPrice);
  if (!(price > 0)) return 'Giá thuê theo tháng phải lớn hơn 0.';
  if (price > MAX_MONTHLY_PRICE) {
    return `Giá thuê theo tháng tối đa ${MAX_MONTHLY_PRICE.toLocaleString('vi-VN')} đ.`;
  }
  if (!hasAtMostTwoDecimals(price)) return 'Giá thuê chỉ được tối đa 2 chữ số thập phân.';
  return null;
}

export function buildPayload(form: WarehouseFormState): WarehouseInput {
  return {
    facilityId: form.facilityId,
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
    images: form.images.map(({ fileKey, name, mimeType, size }) => ({
      fileKey,
      name,
      mimeType,
      ...(size === undefined ? {} : { size }),
    })),
  };
}

const imageOrder = (images: readonly WarehouseImage[]) => images.map((i) => i.fileKey).join('\n');

/** Only the fields that differ from the stored warehouse, so frozen fields are not resent. */
export function buildPatch(form: WarehouseFormState, original: Warehouse): Partial<WarehouseInput> {
  const next = buildPayload(form);
  const before = buildPayload(toFormState(original));
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof WarehouseInput)[]) {
    if (key !== 'images' && next[key] !== before[key]) patch[key] = next[key];
  }
  // Sent only when the set or order changed — the order decides the cover.
  if (imageOrder(form.images) !== imageOrder(original.images ?? [])) patch.images = next.images;
  if (!form.notes.trim() && original.notes) patch.notes = '';
  // A ward left over from the old province must be cleared explicitly, or the API pairs it
  // with the new province and rejects the mismatch.
  if (!form.wardCode && original.wardCode) patch.wardCode = null;
  if (!isIdleStatus(original.status)) {
    delete patch.status;
    delete patch.facilityId;
  }
  return patch as Partial<WarehouseInput>;
}

/** Text to geocode: the typed street plus the chosen ward and province, most specific first. */
export function buildLocateQuery(
  addressLine: string,
  wardName?: string,
  provinceName?: string,
): string {
  return [addressLine, wardName, provinceName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}
