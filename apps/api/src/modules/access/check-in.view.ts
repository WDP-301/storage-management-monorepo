import type { AccessEvent } from '@entities/access-event.entity';
import type { CheckOutMethod } from '@storage/types';

export interface CheckInView {
  eventId: string;
  usedAt: Date | null;
  customer: { fullName: string | null; phone: string | null };
  warehouse: { code: string; name: string } | null;
  facility: { code: string; name: string };
}

export interface CheckInHistoryView extends CheckInView {
  verifiedBy: { id: string; fullName: string } | null;
  checkedOutAt: Date | null;
  checkOutMethod: CheckOutMethod | null;
}

type Named = { code: string; name: string } | null | undefined;
const pick = (row: Named) => (row ? { code: row.code, name: row.name } : null);

/** The columns a view needs; relations are optional so a scan can pass what it already loaded. */
export type CheckInSource = Pick<AccessEvent, 'id' | 'usedAt'> &
  Partial<
    Pick<
      AccessEvent,
      'customer' | 'warehouse' | 'facility' | 'verifier' | 'checkedOutAt' | 'checkOutMethod'
    >
  >;

/** Null-safe on every relation: the audit row must render even if a joined record is gone. */
export function toCheckInView(event: CheckInSource): CheckInHistoryView {
  const { customer, warehouse, facility, verifier } = event;
  return {
    eventId: event.id,
    usedAt: event.usedAt ?? null,
    customer: { fullName: customer?.fullName ?? null, phone: customer?.phone ?? null },
    warehouse: pick(warehouse),
    facility: pick(facility) ?? { code: '', name: '' },
    verifiedBy: verifier ? { id: verifier.id, fullName: verifier.fullName } : null,
    checkedOutAt: event.checkedOutAt ?? null,
    checkOutMethod: event.checkOutMethod ?? null,
  };
}
