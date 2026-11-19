import { Linking, Pressable, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import type { ShelfSigning } from '../../../lib/staff-contracts-api';
import { Text } from '../../components/ui';
import { StatusPill } from '../customer/contract-display';

type Props = { signing: ShelfSigning; onPress: () => void };

/** What is still missing before the shelf contract turns active on its own. */
function pendingLabel(signing: ShelfSigning): string {
  if (!signing.hasDocuments && !signing.firstRentPaid) return 'Chờ file ký & tiền tháng đầu';
  if (!signing.hasDocuments) return 'Chờ file hợp đồng đã ký';
  return 'Chờ thanh toán tháng đầu';
}

export function ShelfSigningListItem({ signing, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
    >
      <View className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-title-sm font-bold text-text-primary">{signing.unitCode}</Text>
            <Text className="text-body-sm text-text-secondary" numberOfLines={1}>
              {signing.facilityName ?? signing.contractNo}
            </Text>
          </View>
          <StatusPill label="Ký hợp đồng kệ" tone="success" />
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-body-sm font-semibold text-text-primary" numberOfLines={1}>
            {signing.customer.fullName ?? 'Khách hàng'}
          </Text>
          {signing.customer.phone ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => void Linking.openURL(`tel:${signing.customer.phone}`)}
            >
              <Text className="text-body-sm font-semibold text-text-link tabular-nums">
                {signing.customer.phone}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="text-caption text-text-secondary tabular-nums">
          {`Hẹn ${formatIsoDateTime(signing.effectiveAt)} · ${pendingLabel(signing)} · ${
            signing.assignee?.fullName ?? 'Chưa phân công'
          }`}
        </Text>
      </View>
    </Pressable>
  );
}
