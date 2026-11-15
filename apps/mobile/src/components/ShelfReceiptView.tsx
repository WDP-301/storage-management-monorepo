import type { ShelfReceiptView as ShelfReceipt } from '@storage/types';
import { View } from 'react-native';
import { formatIsoDateTime } from '../../lib/format-vi';
import { quantityWithUnit, receiptTypeLabel, recoveredLabel } from '../../lib/shelf-storage-format';
import { StatusPill } from '../features/customer/contract-display';
import { EvidenceGallery } from './EvidenceGallery';
import { ReceiptDisputeRow } from './ReceiptDisputeRow';
import { Dashed, Text } from './ui';

/** One drop-off / pick-up receipt: what moved, who recorded it, photos, and the void notice. */
export function ShelfReceiptView({
  receipt,
  onReport,
  onOpenDispute,
}: {
  receipt: ShelfReceipt;
  /** Customer only: reports this receipt as wrong. */
  onReport?: () => void;
  onOpenDispute?: (ticketId: string) => void;
}) {
  const voided = receipt.status === 'VOIDED';
  const dropOff = receipt.type === 'DROP_OFF';
  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-body font-bold text-text-primary">{receipt.code}</Text>
        <View className="flex-row flex-wrap items-center gap-1.5">
          {receipt.recovered ? <StatusPill label={recoveredLabel} tone="warning" /> : null}
          <StatusPill
            label={receiptTypeLabel(receipt.type)}
            tone={voided ? 'neutral' : dropOff ? 'accent' : 'success'}
          />
        </View>
      </View>

      <Text className="text-body-sm text-text-secondary">
        {formatIsoDateTime(String(receipt.createdAt))} · Kệ {receipt.shelf.code}
        {receipt.performedBy ? ` · ${receipt.performedBy.fullName}` : ''}
      </Text>

      <Dashed />

      {voided && receipt.void ? (
        <View className="gap-0.5 rounded-xl bg-danger-0 p-3">
          <Text className="text-body-sm font-semibold text-status-danger">Phiếu đã bị hủy</Text>
          <Text className="text-body-sm text-text-primary">{receipt.void.reason}</Text>
        </View>
      ) : null}

      <View className="gap-1.5">
        {receipt.lines.map((line) => (
          <View key={line.itemId} className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-body text-text-primary">{line.name}</Text>
            <Text className="text-body font-semibold text-text-primary tabular-nums">
              ×{quantityWithUnit(line.quantity, line.unit)}
            </Text>
          </View>
        ))}
      </View>

      {receipt.note ? (
        <Text className="text-body-sm text-text-secondary">Ghi chú: {receipt.note}</Text>
      ) : null}

      <EvidenceGallery files={receipt.photos} />
      <ReceiptDisputeRow receipt={receipt} onReport={onReport} onOpenDispute={onOpenDispute} />
    </View>
  );
}
