import { Text, View } from 'react-native';
import { formatArea, formatDimensions, formatIsoDate, formatNumber } from '../../../lib/format-vi';
import { rentalEndIso, toIsoDate } from '../../../lib/rental-schedule';
import type { ApiContract, ApiInspection } from '../../types/contract-api';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Contract dates are UTC timestamps; slicing the ISO string would give the UTC day, which is a day
 * early for anything set before 07:00 Vietnam time. Read them as the device's local day instead.
 */
export function localDayIso(timestamp: string): string {
  return toIsoDate(new Date(timestamp));
}

export function contractStartIso(contract: ApiContract): string {
  return localDayIso(contract.effectiveAt);
}

/** Lease end: the recorded move-out date, or `effectiveAt + months` while it is still open. */
export function contractEndIso(contract: ApiContract): string {
  return contract.endedAt
    ? localDayIso(contract.endedAt)
    : rentalEndIso(contractStartIso(contract), contract.months);
}

/** Whole local days from today to `dayIso`; negative once it has passed. */
function daysUntil(dayIso: string, now: number): number {
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((new Date(`${dayIso}T00:00:00`).getTime() - startOfToday) / MS_PER_DAY);
}

/**
 * Days until the lease ends — only meaningful while ACTIVE. Negative once the end date has passed:
 * contracts are not closed automatically, so an ACTIVE lease can run past its term.
 */
export function contractDaysLeft(contract: ApiContract, now: number): number | null {
  if (contract.status !== 'ACTIVE') return null;
  return daysUntil(contractEndIso(contract), now);
}

export function contractRemainingLabel(daysLeft: number): string {
  if (daysLeft > 0) return `Còn ${daysLeft} ngày thuê`;
  if (daysLeft < 0) return `Quá hạn ${-daysLeft} ngày`;
  return 'Hết hạn hôm nay';
}

/** Countdown to the handover appointment, shown while the unit is paid for but not received. */
export function handoverCountdownLabel(dayIso: string, now: number): string {
  const days = daysUntil(dayIso, now);
  if (days > 0) return `Nhận kho sau ${days} ngày (${formatIsoDate(dayIso).slice(0, 5)})`;
  if (days === 0) return 'Nhận kho hôm nay';
  return `Quá ngày nhận kho ${-days} ngày`;
}

export type StatusTone = 'success' | 'accent' | 'neutral';

const STATUS_TONES = {
  success: {
    box: 'shrink-0 rounded-full bg-success/10 px-3 py-1',
    label: 'text-xs font-semibold text-success-foreground',
  },
  accent: {
    box: 'shrink-0 rounded-full bg-accent/10 px-3 py-1',
    label: 'text-xs font-semibold text-accent',
  },
  neutral: {
    box: 'shrink-0 rounded-full bg-surface-secondary px-3 py-1',
    label: 'text-xs font-semibold text-muted',
  },
} as const;

/**
 * Replaces heroui-native's Chip here: the Chip caps its own width, so a long unit code beside it
 * would squeeze the label out of sight. This pill hugs its label and never wraps.
 */
export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const tokens = STATUS_TONES[tone];
  return (
    <View className={tokens.box}>
      <Text className={tokens.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export type StorageState = { label: string; tone: StatusTone; hint: string | null };

/** An open return request: asked for, not yet signed off by staff. */
export function openReturn(contract: ApiContract): ApiInspection | null {
  return contract.return && !contract.return.finalizedAt ? contract.return : null;
}

/** What the customer cares about — the unit — derived from the contract and its inspections. */
export function storageState(contract: ApiContract, now: number): StorageState {
  switch (contract.status) {
    case 'DRAFT': {
      const dayIso = localDayIso(contract.handover?.scheduledAt ?? contract.effectiveAt);
      return { label: 'Đã cọc', tone: 'accent', hint: handoverCountdownLabel(dayIso, now) };
    }
    case 'ACTIVE': {
      const pending = openReturn(contract);
      if (pending) {
        const day = pending.scheduledAt ? formatIsoDate(localDayIso(pending.scheduledAt)) : null;
        return { label: 'Chờ trả kho', tone: 'accent', hint: day ? `Hẹn trả ${day}` : null };
      }
      const daysLeft = contractDaysLeft(contract, now);
      return {
        label: 'Đang thuê',
        tone: 'success',
        hint: daysLeft === null ? null : contractRemainingLabel(daysLeft),
      };
    }
    case 'ENDED':
      return { label: 'Đã trả kho', tone: 'neutral', hint: null };
    case 'CANCELLED':
      return { label: 'Đã hủy', tone: 'neutral', hint: null };
    default:
      return { label: contract.status, tone: 'neutral', hint: null };
  }
}

/** The contract document's own status, shown in its section of the detail screen. */
export function contractStatusLabel(status: ApiContract['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'Hiệu lực';
    case 'DRAFT':
      return 'Chờ hiệu lực';
    case 'ENDED':
      return 'Đã kết thúc';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

export function contractStatusTone(status: ApiContract['status']): StatusTone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'accent';
  return 'neutral';
}

export function contractKindLabel(kind: ApiContract['kind']) {
  return kind === 'RENEWAL' ? 'Gia hạn' : 'Thuê mới';
}

/** Warehouse name for a contract; the unit code (= warehouse code) when the facility is missing. */
export function contractWarehouseName(contract: ApiContract): string {
  return contract.facility?.name ?? contract.unit?.code ?? contract.contractNo;
}

/** `KHO-01 · 5 × 8 × 3,5 m · 40 m² · 140 m³` — whichever parts the API provided. */
export function contractUnitSummary(contract: ApiContract): string {
  const unit = contract.unit;
  if (!unit) return '';
  const dimensions =
    unit.widthM !== null && unit.lengthM !== null
      ? formatDimensions(unit.widthM, unit.lengthM, unit.heightM)
      : null;
  return [
    unit.code,
    dimensions,
    formatArea(unit.areaM2),
    unit.volumeM3 !== null ? `${formatNumber(unit.volumeM3)} m³` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
