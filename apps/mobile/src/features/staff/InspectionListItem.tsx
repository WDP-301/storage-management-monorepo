import { Card } from 'heroui-native';
import { Linking, Pressable, Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import type { StaffInspection } from '../../types/inspection-api';
import { StatusPill } from '../customer/contract-display';
import { INSPECTION_KIND_LABEL, scheduledLabel } from './inspection-display';

type Props = { inspection: StaffInspection; onPress: () => void };

export function InspectionListItem({ inspection, onPress }: Props) {
  const done = inspection.finalizedAt !== null;
  return (
    <Pressable onPress={onPress}>
      <Card className="border border-border bg-surface">
        <Card.Body className="gap-2">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground">{inspection.unitCode}</Text>
              <Text className="text-sm text-muted" numberOfLines={1}>
                {inspection.facilityName}
              </Text>
            </View>
            <StatusPill
              label={INSPECTION_KIND_LABEL[inspection.type]}
              tone={inspection.type === 'RETURN' ? 'accent' : 'success'}
            />
          </View>

          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
              {inspection.customerName}
            </Text>
            {inspection.customerPhone ? (
              <Pressable
                hitSlop={8}
                onPress={() => void Linking.openURL(`tel:${inspection.customerPhone}`)}
              >
                <Text className="text-sm font-semibold text-accent">
                  {inspection.customerPhone}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text className="text-xs text-muted">
            {done && inspection.finalizedAt
              ? `Đã chốt ${formatIsoDateTime(inspection.finalizedAt)}`
              : `${scheduledLabel(inspection)} · ${inspection.inspectorName ?? 'Chưa phân công'}`}
          </Text>
        </Card.Body>
      </Card>
    </Pressable>
  );
}
