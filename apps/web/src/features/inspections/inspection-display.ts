import type {
  EvidenceFile,
  InspectionDamage,
  InspectionKind,
  InspectionRecord,
} from '../../types/inspection';

export const INSPECTION_KIND_LABEL: Record<InspectionKind, string> = {
  PRE_HANDOVER: 'Nhận kho',
  RETURN: 'Trả kho',
  MAINTENANCE: 'Bảo trì',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type InspectionState = 'unassigned' | 'open' | 'done';

export function inspectionState(row: InspectionRecord): InspectionState {
  if (row.finalizedAt) return 'done';
  return row.inspectedBy ? 'open' : 'unassigned';
}

export const INSPECTION_STATE_LABEL: Record<InspectionState, string> = {
  unassigned: 'Chưa giao người',
  open: 'Đang chờ',
  done: 'Đã chốt',
};

export const unitCode = (row: InspectionRecord) =>
  row.contract?.bookingItem?.storageUnit?.code ?? '—';
export const facilityId = (row: InspectionRecord) =>
  row.contract?.bookingItem?.storageUnit?.facilityId ?? null;
export const customerName = (row: InspectionRecord) =>
  row.contract?.customerSnapshot?.fullName ?? 'Khách hàng';
export const customerPhone = (row: InspectionRecord) =>
  row.contract?.customerSnapshot?.phone ?? null;

/** dd/mm/yyyy in the viewer's timezone; timestamps are UTC on the wire. */
export function formatDay(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${formatDay(iso)}`;
}

export interface InspectionMetrics {
  pendingHandover: number;
  pendingReturn: number;
  unassigned: number;
  doneLast7Days: number;
}

export function inspectionMetrics(
  rows: readonly InspectionRecord[],
  now: number,
): InspectionMetrics {
  const open = rows.filter((r) => !r.finalizedAt);
  return {
    pendingHandover: open.filter((r) => r.type === 'PRE_HANDOVER').length,
    pendingReturn: open.filter((r) => r.type === 'RETURN').length,
    unassigned: open.filter((r) => !r.inspectedBy).length,
    doneLast7Days: rows.filter(
      (r) => r.finalizedAt && now - new Date(r.finalizedAt).getTime() <= 7 * DAY_MS,
    ).length,
  };
}

/** Case- and accent-insensitive match on unit code, customer name or phone. */
export function matchesSearch(row: InspectionRecord, query: string): boolean {
  const normalise = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/gi, 'd')
      .toLowerCase();
  const q = normalise(query.trim());
  if (!q) return true;
  return [unitCode(row), customerName(row), customerPhone(row) ?? ''].some((field) =>
    normalise(field).includes(q),
  );
}

/** What finalizing does to the contract and unit, shown before the manager confirms. */
export function finalizeConsequence(row: InspectionRecord): string {
  if (row.type === 'PRE_HANDOVER') {
    return 'Hợp đồng sẽ có hiệu lực và kho chuyển sang Đang thuê.';
  }
  const damaged = toDamages(row.damages).length > 0;
  return `Hợp đồng kết thúc và kho chuyển sang ${damaged ? 'Bảo trì (có hư hỏng)' : 'Trống'}.`;
}

export function isEvidenceFile(value: unknown): value is EvidenceFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EvidenceFile).fileKey === 'string'
  );
}

export function toEvidence(values: readonly unknown[] | null | undefined): EvidenceFile[] {
  return (values ?? []).filter(isEvidenceFile);
}

export function toDamages(values: readonly unknown[] | null | undefined): InspectionDamage[] {
  return (values ?? [])
    .filter(
      (v): v is InspectionDamage =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as InspectionDamage).description === 'string',
    )
    .map((d) => ({ ...d, evidence: toEvidence(d.evidence) }));
}
