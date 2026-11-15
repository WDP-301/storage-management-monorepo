import type { ShelfReceiptView as Receipt } from '@storage/types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { newOpenNonce } from '../../../lib/open-nonce';
import { linesSummary, receiptTypeLabel } from '../../../lib/shelf-storage-format';
import { ShelfReceiptView } from '../../components/ShelfReceiptView';
import { Button, Text } from '../../components/ui';
import { StatusPill } from './contract-display';

/**
 * Receipts newest first, voided ones included; more load on demand. Each is one line until
 * tapped, which opens the full receipt with its photos and "Báo sai phiếu".
 */
export function ShelfReceiptHistory({
  receipts,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  receipts: Receipt[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <View className="gap-1.5">
      <Text className="text-body-sm font-semibold text-text-primary">Lịch sử phiếu</Text>
      {receipts.length === 0 ? (
        <Text className="text-body-sm text-text-secondary">Chưa có phiếu.</Text>
      ) : (
        receipts.map((receipt) =>
          openId === receipt.id ? (
            <Pressable key={receipt.id} accessibilityRole="button" onPress={() => setOpenId(null)}>
              <ShelfReceiptView
                receipt={receipt}
                // The ticket-create tab never unmounts: a fresh nonce makes every tap a new prefill.
                onReport={() =>
                  router.navigate({
                    pathname: '/(customer)/ticket-create',
                    params: { shelfReceiptId: receipt.id, nonce: newOpenNonce() },
                  })
                }
                onOpenDispute={(ticketId) =>
                  router.navigate({
                    pathname: '/(customer)/ticket-detail',
                    params: { id: ticketId },
                  })
                }
              />
            </Pressable>
          ) : (
            <Pressable
              key={receipt.id}
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              className="flex-row items-center gap-2 border-b border-border-divider py-2.5"
              onPress={() => setOpenId(receipt.id)}
            >
              <View className="flex-1">
                <Text className="text-body-sm text-text-primary" numberOfLines={1}>
                  {receiptTypeLabel(receipt.type)} · {linesSummary(receipt.lines, 2)}
                </Text>
                <Text className="text-caption text-text-secondary tabular-nums">
                  {receipt.code} · {formatIsoDateTime(String(receipt.createdAt))}
                </Text>
              </View>
              {receipt.status === 'VOIDED' ? <StatusPill label="Đã hủy" tone="neutral" /> : null}
              <Text className="text-body-sm text-text-secondary">›</Text>
            </Pressable>
          ),
        )
      )}
      {hasMore ? (
        <Button
          disabled={isLoadingMore}
          label={isLoadingMore ? 'Đang tải…' : 'Xem thêm'}
          loading={isLoadingMore}
          onPress={onLoadMore}
          size="sm"
          variant="text"
        />
      ) : null}
    </View>
  );
}
