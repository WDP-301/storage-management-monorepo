import type { CheckOutMethod, Visit } from './access-api';

/** How long a stay lasted (or has lasted so far): `45 phút`, `2 giờ 5 phút`. */
export function formatStay(fromIso: string, toMs: number): string {
  const minutes = Math.max(0, Math.floor((toMs - Date.parse(fromIso)) / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
}

const METHOD_LABEL: Record<CheckOutMethod, string> = {
  SCAN: 'Đã ra',
  MANUAL: 'Nhân viên cho ra',
  AUTO: 'Không check-out',
};

/** Short status of a visit for lists: inside, or how it ended. */
export function visitStatusLabel(visit: Pick<Visit, 'checkedOutAt' | 'checkOutMethod'>): string {
  if (!visit.checkedOutAt || !visit.checkOutMethod) return 'Đang trong kho';
  return METHOD_LABEL[visit.checkOutMethod] ?? 'Đã ra';
}

/**
 * Changes whenever the customer enters or leaves: the card compares it between polls to know the
 * shown code was just used and a fresh one is needed.
 */
export function visitsSignature(data: { current: Visit | null; recent: Visit[] }): string {
  const latest = data.recent[0];
  return `${data.current?.id ?? '-'}|${latest?.id ?? '-'}|${latest?.checkedOutAt ?? '-'}`;
}
