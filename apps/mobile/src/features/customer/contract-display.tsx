import { Text, View } from 'react-native';
import { rentalEndIso } from '../../../lib/rental-schedule';
import type { ApiContract } from '../../types/contract-api';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Lease end: the recorded move-out date, or `effectiveAt + months` while it is still open. */
export function contractEndIso(contract: ApiContract): string {
  return contract.endedAt
    ? contract.endedAt.slice(0, 10)
    : rentalEndIso(contract.effectiveAt.slice(0, 10), contract.months);
}

/** Days until the lease ends — only meaningful while ACTIVE. */
export function contractDaysLeft(contract: ApiContract, now: number): number | null {
  if (contract.status !== 'ACTIVE') return null;
  const end = new Date(`${contractEndIso(contract)}T00:00:00`).getTime();
  return Math.max(0, Math.ceil((end - now) / MS_PER_DAY));
}

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
export function ContractStatusChip({ status }: { status: ApiContract['status'] }) {
  const tokens = STATUS_TONES[statusTone(status)];
  return (
    <View className={tokens.box}>
      <Text className={tokens.label} numberOfLines={1}>
        {contractStatusLabel(status)}
      </Text>
    </View>
  );
}

export function contractStatusLabel(status: ApiContract['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'Đang thuê';
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

export function contractKindLabel(kind: ApiContract['kind']) {
  return kind === 'RENEWAL' ? 'Gia hạn' : 'Thuê mới';
}

function statusTone(status: ApiContract['status']): keyof typeof STATUS_TONES {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'accent';
  return 'neutral';
}
