import type { CounterContractView } from '@storage/types';
import { Pressable, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import {
  dropOffBlockLabel,
  dropOffStatusLabel,
  linesSummary,
  pickUpBlockLabel,
  pickupStatusLabel,
  quantityWithUnit,
  receiptTypeLabel,
} from '../../../../lib/shelf-storage-format';
import { Button, colors, DashedDivider, Icon, InlineMessage, Text } from '../../../components/ui';
import { StatusPill } from '../../customer/contract-display';

type Props = {
  contract: CounterContractView;
  onDropOff: (requestId?: string) => void;
  onPickUp: (requestId?: string) => void;
  onOpenReceipt: (receiptId: string) => void;
};

/** One shelf contract of the customer at this warehouse: stock, what is blocked, and the actions. */
export function CounterContractCard({ contract, onDropOff, onPickUp, onOpenReceipt }: Props) {
  const { items, openRequest, openDropOffRequests, recentReceipts } = contract;
  // With one request the plain button serves it; with several, staff pick the one the customer came for.
  const onlyDropOff = openDropOffRequests.length === 1 ? openDropOffRequests[0] : undefined;
  return (
    <View className="gap-3.5 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="text-body-lg font-semibold text-text-primary">
            Kệ {contract.shelf.code}
          </Text>
          <Text className="text-caption text-text-secondary">{contract.contractNo}</Text>
        </View>
        {contract.returnOpen ? <StatusPill label="Đang trả kệ" tone="warning" /> : null}
      </View>

      <DashedDivider />

      <View className="gap-1.5">
        <Text className="text-body font-semibold text-text-primary">Đồ đang trên kệ</Text>
        {items.length === 0 ? (
          <Text className="text-body text-text-secondary">Kệ đang trống.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} className="flex-row justify-between gap-3">
              <Text className="flex-1 text-body text-text-primary">{item.name}</Text>
              <Text className="font-semibold text-body text-text-primary tabular-nums">
                ×{quantityWithUnit(item.quantity, item.unit)}
              </Text>
            </View>
          ))
        )}
      </View>

      {contract.dropOff ? (
        <InlineMessage
          message={`Chưa nhận đồ: ${dropOffBlockLabel(contract.dropOff)}`}
          type="error"
        />
      ) : null}
      {contract.pickUp ? (
        <InlineMessage message={`Chưa trả đồ: ${pickUpBlockLabel(contract.pickUp)}`} type="error" />
      ) : null}

      <View className="flex-row gap-2.5">
        <Button
          className="flex-1"
          disabled={!!contract.dropOff}
          label="Nhận đồ"
          onPress={() => onDropOff(onlyDropOff?.id)}
        />
        <Button
          className="flex-1"
          disabled={!!contract.pickUp}
          label="Trả đồ"
          onPress={() => onPickUp(openRequest?.id)}
          variant="secondary"
        />
      </View>

      {openDropOffRequests.map((request) => (
        <View key={request.id} className="gap-2 rounded-2xl bg-bg-subtle p-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-body font-semibold text-text-primary">Khách yêu cầu gửi đồ</Text>
            <StatusPill
              label={dropOffStatusLabel(request.status)}
              tone={request.status === 'CONFIRMED' ? 'success' : 'accent'}
            />
          </View>
          <Text className="text-body text-text-primary">{linesSummary(request.lines)}</Text>
          <Text className="text-caption text-text-secondary">
            Hẹn gửi {formatIsoDateTime(String(request.requestedFor))}
          </Text>
          <Button
            disabled={!!contract.dropOff}
            fullWidth
            label="Nhận đồ theo yêu cầu"
            onPress={() => onDropOff(request.id)}
            size="sm"
          />
        </View>
      ))}

      {openRequest ? (
        <View className="gap-2 rounded-2xl bg-bg-subtle p-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-body font-semibold text-text-primary">Khách yêu cầu lấy đồ</Text>
            <StatusPill
              label={pickupStatusLabel(openRequest.status)}
              tone={openRequest.status === 'READY' ? 'success' : 'accent'}
            />
          </View>
          <Text className="text-body text-text-primary">{linesSummary(openRequest.lines)}</Text>
          <Text className="text-caption text-text-secondary">
            Hẹn lấy {formatIsoDateTime(String(openRequest.requestedFor))}
          </Text>
          <Button
            disabled={!!contract.pickUp}
            fullWidth
            label="Hoàn tất yêu cầu"
            onPress={() => onPickUp(openRequest.id)}
            size="sm"
          />
        </View>
      ) : null}

      {recentReceipts.length > 0 ? (
        <View className="gap-1.5">
          <DashedDivider />
          <Text className="pt-1 text-body font-semibold text-text-primary">Phiếu gần đây</Text>
          {recentReceipts.map((receipt) => (
            <Pressable
              key={receipt.id}
              accessibilityRole="button"
              className="flex-row items-center justify-between gap-2 rounded-xl px-2 py-2"
              onPress={() => onOpenReceipt(receipt.id)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-body text-text-primary" numberOfLines={1}>
                  {receiptTypeLabel(receipt.type)} · {linesSummary(receipt.lines, 2)}
                </Text>
                <Text className="text-caption text-text-secondary">
                  {receipt.code} · {formatIsoDateTime(String(receipt.createdAt))}
                </Text>
              </View>
              {receipt.status === 'VOIDED' ? <StatusPill label="Đã hủy" tone="neutral" /> : null}
              <Icon color={colors.semantic.textSecondary} name="chevron-right" size={18} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
