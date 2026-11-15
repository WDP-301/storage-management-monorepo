import type { ShelfReceiptRef } from '@storage/types';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { newOpenNonce } from '../../../lib/open-nonce';
import { receiptTypeLabel } from '../../../lib/shelf-storage-format';
import { Button, colors, Icon, Text } from '../../components/ui';

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
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon color={colors.semantic.iconBrand} name="receipt-long" size={18} />
        <Text className="flex-1 text-body font-semibold text-text-primary">
          Phiếu liên quan · {receipt.code} · {receiptTypeLabel(receipt.type)}
          {receipt.status === 'VOIDED' ? ' · Đã hủy' : ''}
        </Text>
      </View>
      <Button
        fullWidth
        label="Xem phiếu"
        onPress={() =>
          router.navigate({
            pathname: '/(staff)/shelf-receipt',
            params: { id: receipt.id, nonce: newOpenNonce(), ticketId },
          })
        }
        size="sm"
        variant="secondary"
      />
    </View>
  );
}
