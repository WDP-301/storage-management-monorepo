import type { ShelfReceiptView as Receipt } from '@storage/types';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { newOpenNonce } from '../../../lib/open-nonce';
import { ShelfReceiptView } from '../../components/ShelfReceiptView';

/** Receipts newest first, voided ones included; more load on demand. */
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
  return (
    <View className="gap-2">
      <Text className="font-strong text-body-sm text-foreground">Lịch sử phiếu</Text>
      {receipts.length === 0 ? (
        <Text className="font-body text-body-sm text-muted">Chưa có phiếu gửi / lấy đồ nào.</Text>
      ) : (
        receipts.map((receipt) => (
          <ShelfReceiptView
            key={receipt.id}
            receipt={receipt}
            // The ticket-create tab never unmounts: a fresh nonce makes every tap a new prefill.
            onReport={() =>
              router.navigate({
                pathname: '/(customer)/ticket-create',
                params: { shelfReceiptId: receipt.id, nonce: newOpenNonce() },
              })
            }
            onOpenDispute={(ticketId) =>
              router.navigate({ pathname: '/(customer)/ticket-detail', params: { id: ticketId } })
            }
          />
        ))
      )}
      {hasMore ? (
        <Button isDisabled={isLoadingMore} variant="secondary" onPress={onLoadMore}>
          <Button.Label>{isLoadingMore ? 'Đang tải…' : 'Xem thêm'}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
