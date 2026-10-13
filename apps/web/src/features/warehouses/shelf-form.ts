import type {
  BulkCreateShelvesInput,
  ShelfCreateInput,
  ShelfUpdateInput,
  Warehouse,
  WarehouseIdleStatus,
} from '../../types/warehouse';
import { DEPOSIT_DEFAULT, isIdleStatus, MAX_MONTHLY_PRICE, MAX_SIDE_M } from './warehouse-form';

export interface ShelfFormState {
  code: string;
  name: string;
  widthM: string;
  lengthM: string;
  heightM: string;
  monthlyPrice: string;
  depositMonths: string;
  notes: string;
  status: WarehouseIdleStatus;
}

export const EMPTY_SHELF_FORM: ShelfFormState = {
  code: '',
  name: '',
  widthM: '',
  lengthM: '',
  heightM: '',
  monthlyPrice: '',
  depositMonths: DEPOSIT_DEFAULT,
  notes: '',
  status: 'AVAILABLE',
};

export interface BulkShelfFormState {
  prefix: string;
  from: string;
  to: string;
  pad: string;
  widthM: string;
  lengthM: string;
  heightM: string;
  monthlyPrice: string;
  depositMonths: string;
}

export const EMPTY_BULK_SHELF_FORM: BulkShelfFormState = {
  prefix: 'A',
  from: '1',
  to: '10',
  pad: '2',
  widthM: '',
  lengthM: '',
  heightM: '',
  monthlyPrice: '',
  depositMonths: DEPOSIT_DEFAULT,
};

export const MAX_BULK_SHELVES = 200;
export const MAX_UNIT_CODE_LENGTH = 50;

const num = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));
const hasAtMostTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

export const toShelfFormState = (shelf: Warehouse): ShelfFormState => ({
  code: shelf.code,
  name: shelf.name,
  widthM: String(shelf.widthM),
  lengthM: String(shelf.lengthM),
  heightM: shelf.heightM === null ? '' : String(shelf.heightM),
  monthlyPrice: String(shelf.monthlyPrice),
  depositMonths: shelf.depositMonths === null ? DEPOSIT_DEFAULT : String(shelf.depositMonths),
  notes: shelf.notes ?? '',
  status: isIdleStatus(shelf.status) ? shelf.status : 'AVAILABLE',
});

/** Mirrors the API default shelf name: "<warehouse.name> · Kệ <shortCode>". */
export function defaultShelfNamePreview(
  parent: Pick<Warehouse, 'code' | 'name'>,
  rawCode: string,
): string {
  const code = rawCode.trim();
  if (!code) return `${parent.name} · Kệ ...`;
  const prefix = `${parent.code}-`;
  const own = code.startsWith(prefix) ? code.slice(prefix.length) : code;
  return `${parent.name} · Kệ ${own}`.slice(0, 150);
}

const checkDimension = (label: string, value: string, required: boolean): string | null => {
  if (!required && value.trim() === '') return null;
  const n = num(value);
  if (!(n > 0)) return `${label} phải là số lớn hơn 0.`;
  if (n > MAX_SIDE_M) return `${label} tối đa ${MAX_SIDE_M} m.`;
  if (!hasAtMostTwoDecimals(n)) return `${label} chỉ được tối đa 2 chữ số thập phân.`;
  return null;
};

const checkPrice = (value: string): string | null => {
  const price = num(value);
  if (!(price > 0)) return 'Giá thuê kệ theo tháng phải lớn hơn 0.';
  if (price > MAX_MONTHLY_PRICE) {
    return `Giá thuê kệ tối đa ${MAX_MONTHLY_PRICE.toLocaleString('vi-VN')} đ.`;
  }
  if (!hasAtMostTwoDecimals(price)) return 'Giá thuê chỉ được tối đa 2 chữ số thập phân.';
  return null;
};

export function validateShelfForm(form: ShelfFormState, frozen = false): string | null {
  const code = form.code.trim();
  if (!code) return 'Vui lòng nhập mã kệ.';
  if (code.length > MAX_UNIT_CODE_LENGTH) return `Mã kệ tối đa ${MAX_UNIT_CODE_LENGTH} ký tự.`;
  if (!frozen) {
    const dimProblem =
      checkDimension('Chiều rộng', form.widthM, true) ??
      checkDimension('Chiều dài', form.lengthM, true) ??
      checkDimension('Chiều cao', form.heightM, false);
    if (dimProblem) return dimProblem;
  }
  return checkPrice(form.monthlyPrice);
}

export function buildShelfCreatePayload(form: ShelfFormState): ShelfCreateInput {
  return {
    code: form.code.trim(),
    ...(form.name.trim() ? { name: form.name.trim() } : {}),
    widthM: Number(form.widthM),
    lengthM: Number(form.lengthM),
    ...(form.heightM.trim() !== '' ? { heightM: Number(form.heightM) } : {}),
    monthlyPrice: Number(form.monthlyPrice),
    depositMonths: form.depositMonths === DEPOSIT_DEFAULT ? null : Number(form.depositMonths),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    status: form.status,
  };
}

export function buildShelfUpdatePatch(form: ShelfFormState, original: Warehouse): ShelfUpdateInput {
  const nextHeight = form.heightM.trim() === '' ? null : Number(form.heightM);
  const nextDeposit = form.depositMonths === DEPOSIT_DEFAULT ? null : Number(form.depositMonths);
  const nextNotes = form.notes.trim();
  const patch: ShelfUpdateInput = {};

  if (form.code.trim() !== original.code) patch.code = form.code.trim();
  if (form.name.trim() && form.name.trim() !== original.name) patch.name = form.name.trim();
  if (Number(form.widthM) !== original.widthM) patch.widthM = Number(form.widthM);
  if (Number(form.lengthM) !== original.lengthM) patch.lengthM = Number(form.lengthM);
  if (nextHeight !== original.heightM) patch.heightM = nextHeight;
  if (Number(form.monthlyPrice) !== original.monthlyPrice) {
    patch.monthlyPrice = Number(form.monthlyPrice);
  }
  if (nextDeposit !== original.depositMonths) patch.depositMonths = nextDeposit;
  if (nextNotes !== (original.notes ?? '')) patch.notes = nextNotes;
  if (isIdleStatus(original.status) && form.status !== original.status) {
    patch.status = form.status;
  }

  if (!isIdleStatus(original.status)) {
    delete patch.code;
    delete patch.widthM;
    delete patch.lengthM;
    delete patch.heightM;
    delete patch.status;
  }

  return patch;
}

export function previewBulkShelfCodes(
  parentCode: string,
  form: Pick<BulkShelfFormState, 'prefix' | 'from' | 'to' | 'pad'>,
): { count: number; firstCode: string; lastCode: string } | null {
  const prefix = form.prefix.trim();
  if (!/^[A-Za-z0-9]{1,10}$/.test(prefix)) return null;
  const from = num(form.from);
  const to = num(form.to);
  const pad = form.pad.trim() === '' ? 2 : num(form.pad);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) return null;
  if (!Number.isInteger(pad) || pad < 0 || pad > 6) return null;
  const count = to - from + 1;
  if (count > MAX_BULK_SHELVES) return null;
  const firstCode = `${parentCode}-${prefix}-${String(from).padStart(pad, '0')}`;
  const lastCode = `${parentCode}-${prefix}-${String(to).padStart(pad, '0')}`;
  return { count, firstCode, lastCode };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * First free number after the highest `<parentCode>-<prefix>-<n>` already in the building, so the
 * suggested range never collides with existing shelves (deleted gaps are left alone on purpose).
 */
export function nextShelfNumber(
  shelves: readonly Pick<Warehouse, 'code'>[],
  parentCode: string,
  prefix: string,
): number {
  const pattern = new RegExp(
    `^${escapeRegExp(parentCode)}-${escapeRegExp(prefix.trim())}-(\\d+)$`,
    'i',
  );
  let highest = 0;
  for (const { code } of shelves) {
    const match = pattern.exec(code);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

/** Re-anchors the bulk range on the next free number for `prefix`, keeping its size. */
export function withNextBulkRange(
  form: BulkShelfFormState,
  shelves: readonly Pick<Warehouse, 'code'>[],
  parentCode: string,
): BulkShelfFormState {
  const span = Math.max(0, num(form.to) - num(form.from)) || 0;
  const from = nextShelfNumber(shelves, parentCode, form.prefix);
  return { ...form, from: String(from), to: String(from + span) };
}

export function validateBulkShelfForm(parentCode: string, form: BulkShelfFormState): string | null {
  const prefix = form.prefix.trim();
  if (!/^[A-Za-z0-9]{1,10}$/.test(prefix)) {
    return 'Tiền tố dãy kệ chỉ được gồm chữ cái hoặc số (1–10 ký tự), ví dụ: A, B1.';
  }
  const from = num(form.from);
  const to = num(form.to);
  if (!Number.isInteger(from) || from < 0 || from > 99999) {
    return 'Số thứ tự bắt đầu phải là số nguyên từ 0 đến 99999.';
  }
  if (!Number.isInteger(to) || to < 0 || to > 99999) {
    return 'Số thứ tự kết thúc phải là số nguyên từ 0 đến 99999.';
  }
  if (to < from) {
    return 'Số thứ tự kết thúc phải lớn hơn hoặc bằng số bắt đầu.';
  }
  const count = to - from + 1;
  if (count > MAX_BULK_SHELVES) {
    return `Mỗi lần tạo hàng loạt tối đa ${MAX_BULK_SHELVES} kệ (hiện tại: ${count} kệ).`;
  }
  const pad = form.pad.trim() === '' ? 2 : num(form.pad);
  if (!Number.isInteger(pad) || pad < 0 || pad > 6) {
    return 'Độ dài đệm số thứ tự (pad) phải là số nguyên từ 0 đến 6.';
  }
  const longestCode = `${parentCode}-${prefix}-${String(to).padStart(pad, '0')}`;
  if (longestCode.length > MAX_UNIT_CODE_LENGTH) {
    return `Mã kệ sinh ra (${longestCode}) vượt quá ${MAX_UNIT_CODE_LENGTH} ký tự.`;
  }
  const dimProblem =
    checkDimension('Chiều rộng', form.widthM, true) ??
    checkDimension('Chiều dài', form.lengthM, true) ??
    checkDimension('Chiều cao', form.heightM, false);
  if (dimProblem) return dimProblem;
  return checkPrice(form.monthlyPrice);
}

export function buildBulkShelfPayload(form: BulkShelfFormState): BulkCreateShelvesInput {
  const pad = form.pad.trim() === '' ? 2 : Number(form.pad);
  return {
    prefix: form.prefix.trim(),
    from: Number(form.from),
    to: Number(form.to),
    pad,
    widthM: Number(form.widthM),
    lengthM: Number(form.lengthM),
    ...(form.heightM.trim() !== '' ? { heightM: Number(form.heightM) } : {}),
    monthlyPrice: Number(form.monthlyPrice),
    depositMonths: form.depositMonths === DEPOSIT_DEFAULT ? null : Number(form.depositMonths),
  };
}
