import type { ShelfReceiptView as ShelfReceipt } from '@storage/types';
import { Text, View } from 'react-native';
import { formatIsoDateTime } from '../../lib/format-vi';
import { receiptTypeLabel, recoveredLabel } from '../../lib/shelf-storage-format';
import { StatusPill } from '../features/customer/contract-display';
import { EvidenceGallery } from './EvidenceGallery';

/** One drop-off / pick-up receipt: what moved, who recorded it, photos, and the void notice. */
export function ShelfReceiptView({ receipt }: { receipt: ShelfReceipt }) {
  const voided = receipt.status === 'VOIDED';
  const dropOff = receipt.type === 'DROP_OFF';
  return (
    <View className="gap-2.5 rounded-xl border border-border bg-surface p-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-strong text-body-md text-foreground">{receipt.code}</Text>
        <View className="flex-row flex-wrap items-center gap-1.5">
          {receipt.recovered ? <StatusPill label={recoveredLabel} tone="warning" /> : null}
          <StatusPill
            label={receiptTypeLabel(receipt.type)}
            tone={voided ? 'neutral' : dropOff ? 'accent' : 'success'}
          />
        </View>
      </View>

      <Text className="font-body text-body-sm text-muted">
        {formatIsoDateTime(String(receipt.createdAt))} · Kệ {receipt.shelf.code}
        {receipt.performedBy ? ` · ${receipt.performedBy.fullName}` : ''}
      </Text>

      {voided && receipt.void ? (
        <View className="gap-0.5 rounded-lg bg-danger-bg p-2.5">
          <Text className="font-strong text-body-sm text-danger">Phiếu đã bị hủy</Text>
          <Text className="font-body text-body-sm text-foreground">{receipt.void.reason}</Text>
        </View>
      ) : null}

      <View className="gap-1">
        {receipt.lines.map((line) => (
          <View key={line.itemId} className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 font-body text-body-md text-foreground">{line.name}</Text>
            <Text className="font-strong text-body-md text-foreground">×{line.quantity}</Text>
          </View>
        ))}
      </View>

      {receipt.note ? (
        <Text className="font-body text-body-sm text-muted">Ghi chú: {receipt.note}</Text>
      ) : null}

      <EvidenceGallery files={receipt.photos} />
    </View>
  );
}
