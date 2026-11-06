import type { CounterContractView } from '@storage/types';
import { Button } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import {
  dropOffBlockLabel,
  linesSummary,
  pickUpBlockLabel,
  pickupStatusLabel,
  receiptTypeLabel,
} from '../../../../lib/shelf-storage-format';
import { StatusPill } from '../../customer/contract-display';

type Props = {
  contract: CounterContractView;
  onDropOff: () => void;
  onPickUp: (requestId?: string) => void;
  onOpenReceipt: (receiptId: string) => void;
};

/** One shelf contract of the customer at this warehouse: stock, what is blocked, and the actions. */
export function CounterContractCard({ contract, onDropOff, onPickUp, onOpenReceipt }: Props) {
  const { items, openRequest, recentReceipts } = contract;
  return (
    <View className="gap-3 rounded-xl border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="font-strong text-body-md text-foreground">Kệ {contract.shelf.code}</Text>
          <Text className="font-body text-caption text-muted">{contract.contractNo}</Text>
        </View>
        {contract.returnOpen ? <StatusPill label="Đang trả kệ" tone="warning" /> : null}
      </View>

      <View className="gap-1">
        <Text className="font-ui text-body-sm text-foreground">Đồ đang trên kệ</Text>
        {items.length === 0 ? (
          <Text className="font-body text-body-sm text-muted">Kệ đang trống.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} className="flex-row justify-between gap-3">
              <Text className="flex-1 font-body text-body-sm text-foreground">{item.name}</Text>
              <Text className="font-strong text-body-sm text-foreground">×{item.quantity}</Text>
            </View>
          ))
        )}
      </View>

      {contract.dropOff ? (
        <Text className="font-body text-caption text-danger">
          Chưa nhận đồ: {dropOffBlockLabel(contract.dropOff)}
        </Text>
      ) : null}
      {contract.pickUp ? (
        <Text className="font-body text-caption text-danger">
          Chưa trả đồ: {pickUpBlockLabel(contract.pickUp)}
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <Button className="flex-1" isDisabled={!!contract.dropOff} onPress={onDropOff}>
          <Button.Label>Nhận đồ</Button.Label>
        </Button>
        <Button
          className="flex-1"
          variant="secondary"
          isDisabled={!!contract.pickUp}
          onPress={() => onPickUp()}
        >
          <Button.Label>Trả đồ</Button.Label>
        </Button>
      </View>

      {openRequest ? (
        <View className="gap-1.5 rounded-lg bg-surface-secondary p-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-ui text-body-sm text-foreground">Khách yêu cầu lấy đồ</Text>
            <StatusPill
              label={pickupStatusLabel(openRequest.status)}
              tone={openRequest.status === 'READY' ? 'success' : 'accent'}
            />
          </View>
          <Text className="font-body text-body-sm text-foreground">
            {linesSummary(openRequest.lines)}
          </Text>
          <Text className="font-body text-caption text-muted">
            Hẹn lấy {formatIsoDateTime(String(openRequest.requestedFor))}
          </Text>
          <Button size="sm" isDisabled={!!contract.pickUp} onPress={() => onPickUp(openRequest.id)}>
            <Button.Label>Hoàn tất yêu cầu</Button.Label>
          </Button>
        </View>
      ) : null}

      {recentReceipts.length > 0 ? (
        <View className="gap-1">
          <Text className="font-ui text-body-sm text-foreground">Phiếu gần đây</Text>
          {recentReceipts.map((receipt) => (
            <Pressable
              key={receipt.id}
              accessibilityRole="button"
              className="flex-row items-center justify-between gap-2 py-1.5"
              onPress={() => onOpenReceipt(receipt.id)}
            >
              <View className="flex-1">
                <Text className="font-body text-body-sm text-foreground" numberOfLines={1}>
                  {receiptTypeLabel(receipt.type)} · {linesSummary(receipt.lines, 2)}
                </Text>
                <Text className="font-body text-caption text-muted">
                  {receipt.code} · {formatIsoDateTime(String(receipt.createdAt))}
                </Text>
              </View>
              {receipt.status === 'VOIDED' ? <StatusPill label="Đã hủy" tone="neutral" /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
