import type { ContractPatch, ContractRecord, ContractStatus } from '../../types/contract';

export const CONTRACT_STATUS_LABEL: Record<
  ContractStatus,
  { label: string; variant: 'warning' | 'success' | 'neutral' | 'error' }
> = {
  // A DRAFT exists once the deposit is paid; it becomes ACTIVE when the handover is signed.
  DRAFT: { label: 'Chờ nhận kho', variant: 'warning' },
  ACTIVE: { label: 'Đang hiệu lực', variant: 'success' },
  ENDED: { label: 'Đã kết thúc', variant: 'neutral' },
  CANCELLED: { label: 'Đã hủy', variant: 'error' },
};

export const CONTRACT_STATUSES = Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[];

export const CONTRACT_KIND_LABEL: Record<ContractRecord['kind'], string> = {
  INITIAL: 'Thuê mới',
  RENEWAL: 'Gia hạn',
};

/** "CT-<uuid>" is unreadable on screen or over the phone; the first block is enough to find it. */
export function shortContractNo(contractNo: string): string {
  const match = /^CT-([0-9a-f]{8})/i.exec(contractNo);
  return match ? `CT-${match[1].toUpperCase()}` : contractNo;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd of the viewer's local day, the value a date input expects. */
export function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a date-input value, as ISO for the API. */
export function fromDateInput(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/**
 * The last moment of a date-input day. An end date names the last day of use, and the API
 * treats a contract as running while `endedAt >= now`, so midnight would cut that day off.
 */
export function endOfDateInput(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/**
 * Last day of the term: start + N months, minus one day, clamped so 31/01 + 1 month ends on
 * 27/02 rather than rolling into March. Matches what the customer app shows.
 */
export function plannedEnd(contract: Pick<ContractRecord, 'effective_at' | 'months'>): string {
  const start = new Date(contract.effective_at);
  const targetMonth = start.getMonth() + contract.months;
  const lastDayOfTargetMonth = new Date(start.getFullYear(), targetMonth + 1, 0).getDate();
  const end = new Date(
    start.getFullYear(),
    targetMonth,
    Math.min(start.getDate(), lastDayOfTargetMonth),
  );
  end.setDate(end.getDate() - 1);
  return end.toISOString();
}

export type HandoverState = 'none' | 'unassigned' | 'assigned' | 'done';

export function handoverState(contract: Pick<ContractRecord, 'handover'>): HandoverState {
  const { handover } = contract;
  if (!handover) return 'none';
  if (handover.finalized_at) return 'done';
  return handover.inspector_name ? 'assigned' : 'unassigned';
}

export const HANDOVER_STATE_LABEL: Record<HandoverState, string> = {
  none: '—',
  unassigned: 'Chưa giao người',
  assigned: 'Đã giao nhân viên',
  done: 'Đã bàn giao',
};

export const MAX_CONTRACT_DOCUMENTS = 10;
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

/** Client-side pre-check so a bad pick never costs an upload; the API stays the authority. */
export function validateNewDocuments(existing: number, files: readonly File[]): string | null {
  if (existing + files.length > MAX_CONTRACT_DOCUMENTS)
    return `Mỗi hợp đồng tối đa ${MAX_CONTRACT_DOCUMENTS} file (hiện có ${existing}).`;
  for (const file of files) {
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type))
      return `"${file.name}" không đúng định dạng — chỉ nhận ảnh (JPG, PNG, WebP, HEIC) hoặc PDF.`;
    if (file.size > MAX_DOCUMENT_BYTES) return `"${file.name}" vượt quá 15 MB.`;
    if (file.size === 0) return `"${file.name}" là file rỗng.`;
  }
  return null;
}

export interface ContractFormState {
  effectiveAt: string;
  months: string;
  monthlyPrice: string;
  endedAt: string;
}

export const toContractForm = (c: ContractRecord): ContractFormState => ({
  effectiveAt: toDateInput(c.effective_at),
  months: String(c.months),
  monthlyPrice: String(Number(c.monthly_price)),
  endedAt: toDateInput(c.ended_at),
});

/** Signing seals the commercial terms; only the end date may change afterwards. */
export const isSealed = (c: Pick<ContractRecord, 'signed_at'>) => Boolean(c.signed_at);

export function validateContractForm(
  form: ContractFormState,
  original: ContractRecord,
): string | null {
  // The API cannot clear a stored end date (it only accepts a date).
  if (original.ended_at && !form.endedAt) return 'Không thể xóa ngày kết thúc đã lưu.';
  if (!isSealed(original)) {
    if (!form.effectiveAt) return 'Vui lòng chọn ngày hiệu lực.';
    const months = Number(form.months);
    if (!Number.isInteger(months) || months < 1 || months > 60)
      return 'Thời hạn phải là số nguyên từ 1 đến 60 tháng.';
    const price = Number(form.monthlyPrice);
    if (form.monthlyPrice.trim() === '' || !Number.isFinite(price) || price < 0)
      return 'Giá thuê phải là số không âm.';
  }
  if (form.endedAt && form.effectiveAt && form.endedAt <= form.effectiveAt)
    return 'Ngày kết thúc phải sau ngày hiệu lực.';
  return null;
}

/** Only fields that changed; a sealed contract never resends its commercial terms. */
export function buildContractPatch(
  form: ContractFormState,
  original: ContractRecord,
): ContractPatch {
  const before = toContractForm(original);
  const patch: ContractPatch = {};
  if (!isSealed(original)) {
    if (form.effectiveAt !== before.effectiveAt)
      patch.effectiveAt = fromDateInput(form.effectiveAt);
    if (form.months !== before.months) patch.months = Number(form.months);
    if (Number(form.monthlyPrice) !== Number(before.monthlyPrice))
      patch.monthlyPriceSnapshot = Number(form.monthlyPrice);
  }
  if (form.endedAt && form.endedAt !== before.endedAt) patch.endedAt = endOfDateInput(form.endedAt);
  return patch;
}
