import type { AccessEvent } from '@entities/access-event.entity';

export interface CheckInView {
  eventId: string;
  usedAt: Date | null;
  customer: { fullName: string | null; phone: string | null };
  contract: { id: string; contractNo: string; endedAt: Date | null };
  unit: { code: string; name: string };
  warehouse: { code: string; name: string } | null;
  facility: { code: string; name: string };
}

export interface CheckInHistoryView extends CheckInView {
  verifiedBy: { id: string; fullName: string } | null;
}

type Named = { code: string; name: string } | null | undefined;
const pick = (row: Named) => (row ? { code: row.code, name: row.name } : null);

/** The columns a view needs; relations are optional so a scan can pass what it already loaded. */
export type CheckInSource = Pick<AccessEvent, 'id' | 'contractId' | 'usedAt'> &
  Partial<Pick<AccessEvent, 'contract' | 'storageUnit' | 'facility' | 'verifier'>>;

/** Null-safe on every relation: the audit row must render even if a joined record is gone. */
export function toCheckInView(event: CheckInSource): CheckInHistoryView {
  const { contract, storageUnit, facility, verifier } = event;
  return {
    eventId: event.id,
    usedAt: event.usedAt ?? null,
    customer: {
      fullName: contract?.customer?.fullName ?? null,
      phone: contract?.customer?.phone ?? null,
    },
    contract: {
      id: event.contractId,
      contractNo: contract?.contractNo ?? '',
      endedAt: contract?.endedAt ?? null,
    },
    unit: pick(storageUnit) ?? { code: '', name: '' },
    warehouse: pick(storageUnit?.parent),
    facility: pick(facility) ?? { code: '', name: '' },
    verifiedBy: verifier ? { id: verifier.id, fullName: verifier.fullName } : null,
  };
}
