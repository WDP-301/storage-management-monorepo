import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { todayIso } from '../../../lib/rental-schedule';
import type { InspectionKind, StaffInspection } from '../../types/inspection-api';
import { ChipButton } from '../customer/FilterChips';
import { InspectionListItem } from './InspectionListItem';
import { groupBySchedule, SCHEDULE_GROUP_LABEL } from './inspection-display';
import { useStaffInspections } from './use-staff-inspections';

type Segment = 'handover' | 'return' | 'done';

const SEGMENT_KIND: Record<Exclude<Segment, 'done'>, InspectionKind> = {
  handover: 'PRE_HANDOVER',
  return: 'RETURN',
};

type Props = { onOpen: (contractId: string) => void };

/** Today tab: the handovers and returns to carry out, grouped by appointment day. */
export function StaffTodayScreen({ onOpen }: Props) {
  const [segment, setSegment] = useState<Segment>('handover');
  const { items, isLoading, error, refetch } = useStaffInspections(
    segment === 'done' ? 'done' : 'open',
  );

  const groups = useMemo(() => {
    if (segment === 'done') return [{ title: null, items }];
    const ofKind = items.filter((item) => item.type === SEGMENT_KIND[segment]);
    return groupBySchedule(ofKind, todayIso()).map((bucket) => ({
      title: SCHEDULE_GROUP_LABEL[bucket.group],
      items: bucket.items,
    }));
  }, [items, segment]);
  const open = (item: StaffInspection) => {
    if (item.contract) onOpen(item.contract.id);
    else Alert.alert('Không mở được', 'Biên bản này chưa gắn với hợp đồng nào.');
  };
  const isEmpty = groups.every((group) => group.items.length === 0);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={isLoading && !isEmpty} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-title-md font-strong tracking-tight text-foreground">Hôm nay</Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          Lượt nhận và trả kho cần lập biên bản.
        </Text>

        <View className="mt-4 flex-row gap-2">
          <ChipButton
            label="Nhận kho"
            isSelected={segment === 'handover'}
            onPress={() => setSegment('handover')}
          />
          <ChipButton
            label="Trả kho"
            isSelected={segment === 'return'}
            onPress={() => setSegment('return')}
          />
          <ChipButton
            label="Đã xong"
            isSelected={segment === 'done'}
            onPress={() => setSegment('done')}
          />
        </View>

        {error ? (
          <View className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
            <Text className="font-body text-body-sm text-danger">{error}</Text>
          </View>
        ) : null}

        {isLoading && isEmpty ? (
          <ActivityIndicator className="mt-12" />
        ) : isEmpty ? (
          <Text className="font-body mt-12 text-center text-body-sm text-muted">
            {segment === 'done'
              ? 'Chưa có biên bản nào được chốt.'
              : 'Không có lượt nào cần xử lý.'}
          </Text>
        ) : (
          groups.map((group) => (
            <View key={group.title ?? 'all'} className="mt-5 gap-3">
              {group.title ? (
                <Text className="text-body-sm font-strong text-muted">
                  {group.title} · {group.items.length}
                </Text>
              ) : null}
              {group.items.map((item) => (
                <InspectionListItem key={item.id} inspection={item} onPress={() => open(item)} />
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
