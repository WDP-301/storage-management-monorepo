import type { ShelfReceiptRef } from '@storage/types';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { newOpenNonce } from '../../../lib/open-nonce';
import { receiptTypeLabel } from '../../../lib/shelf-storage-format';

/** The receipt a customer reported as wrong; opens it and returns to this ticket afterwards. */
export function TicketReceiptLink({
  receipt,
  ticketId,
}: {
  receipt: ShelfReceiptRef | null | undefined;
  ticketId: string;
}) {
  const router = useRouter();
  if (!receipt) return null;
  return (
    <View className="gap-2 rounded-xl border border-border bg-surface p-3">
      <Text className="font-strong text-body-md text-foreground">
        Phiếu liên quan · {receipt.code} · {receiptTypeLabel(receipt.type)}
        {receipt.status === 'VOIDED' ? ' · Đã hủy' : ''}
      </Text>
      <Button
        size="sm"
        variant="secondary"
        onPress={() =>
          router.navigate({
            pathname: '/(staff)/shelf-receipt',
            params: { id: receipt.id, nonce: newOpenNonce(), ticketId },
          })
        }
      >
        <Button.Label>Xem phiếu</Button.Label>
      </Button>
    </View>
  );
}
