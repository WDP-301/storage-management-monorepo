import { Linking, Pressable, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { Text } from '../../components/ui';
import type { StaffInspection } from '../../types/inspection-api';
import { StatusPill } from '../customer/contract-display';
import { INSPECTION_KIND_LABEL, scheduledLabel } from './inspection-display';

type Props = { inspection: StaffInspection; onPress: () => void };

export function InspectionListItem({ inspection, onPress }: Props) {
  const done = inspection.finalizedAt !== null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
    >
      <View className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-title-sm font-bold text-text-primary">{inspection.unitCode}</Text>
            <Text className="text-body-sm text-text-secondary" numberOfLines={1}>
              {inspection.facilityName}
            </Text>
          </View>
          <StatusPill
            label={INSPECTION_KIND_LABEL[inspection.type]}
            tone={
              inspection.type === 'RETURN'
                ? 'accent'
                : inspection.type === 'PRE_HANDOVER'
                  ? 'success'
                  : 'warning'
            }
          />
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-body-sm font-semibold text-text-primary" numberOfLines={1}>
            {inspection.customerName}
          </Text>
          {inspection.customerPhone ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => void Linking.openURL(`tel:${inspection.customerPhone}`)}
            >
              <Text className="text-body-sm font-semibold text-text-link tabular-nums">
                {inspection.customerPhone}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="text-caption text-text-secondary tabular-nums">
          {done && inspection.finalizedAt
            ? `Đã chốt ${formatIsoDateTime(inspection.finalizedAt)}`
            : `${scheduledLabel(inspection)} · ${inspection.inspectorName ?? 'Chưa phân công'}`}
        </Text>
      </View>
    </Pressable>
  );
}
