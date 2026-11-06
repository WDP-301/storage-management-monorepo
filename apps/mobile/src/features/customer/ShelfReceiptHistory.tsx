import type { ShelfReceiptView as Receipt } from '@storage/types';
import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
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
  return (
    <View className="gap-2">
      <Text className="font-strong text-body-sm text-foreground">Lịch sử phiếu</Text>
      {receipts.length === 0 ? (
        <Text className="font-body text-body-sm text-muted">Chưa có phiếu gửi / lấy đồ nào.</Text>
      ) : (
        receipts.map((receipt) => <ShelfReceiptView key={receipt.id} receipt={receipt} />)
      )}
      {hasMore ? (
        <Button isDisabled={isLoadingMore} variant="secondary" onPress={onLoadMore}>
          <Button.Label>{isLoadingMore ? 'Đang tải…' : 'Xem thêm'}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
