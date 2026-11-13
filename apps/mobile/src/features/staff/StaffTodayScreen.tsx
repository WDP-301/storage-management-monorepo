import type { TourAppointmentRecord } from '@storage/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { todayIso } from '../../../lib/rental-schedule';
import { TourAppointmentsApi } from '../../../lib/tour-appointments-api';
import type { InspectionKind, StaffInspection } from '../../types/inspection-api';
import { ChipButton } from '../customer/FilterChips';
import { InspectionListItem } from './InspectionListItem';
import { groupBySchedule, SCHEDULE_GROUP_LABEL } from './inspection-display';
import { StaffTourListItem } from './StaffTourListItem';
import { useStaffInspections } from './use-staff-inspections';

type Segment = 'handover' | 'return' | 'maintenance' | 'tours' | 'done';

const SEGMENT_KIND: Record<Exclude<Segment, 'done' | 'tours'>, InspectionKind> = {
  handover: 'PRE_HANDOVER',
  return: 'RETURN',
  maintenance: 'MAINTENANCE',
};

type Props = {
  onOpen: (contractId: string) => void;
  onOpenTour?: (tourId: string) => void;
  onOpenMaintenance?: (inspectionId: string) => void;
};

/** Today tab: the handovers, returns, maintenance checks and tour appointments to carry out. */
export function StaffTodayScreen({ onOpen, onOpenTour, onOpenMaintenance }: Props) {
  const [segment, setSegment] = useState<Segment>('handover');
  const { items, isLoading, error, refetch } = useStaffInspections(
    segment === 'done' ? 'done' : 'open',
  );

  const [tours, setTours] = useState<TourAppointmentRecord[]>([]);
  const [isToursLoading, setIsToursLoading] = useState(false);
  const [toursError, setToursError] = useState<string | null>(null);

  const fetchTours = useCallback(async () => {
    setIsToursLoading(true);
    setToursError(null);
    try {
      const res = await TourAppointmentsApi.list({ limit: 50 });
      setTours(res.appointments);
    } catch (_err) {
      setToursError('Không tải được danh sách ca dẫn khách.');
    } finally {
      setIsToursLoading(false);
    }
  }, []);

  useEffect(() => {
    if (segment === 'tours') {
      void fetchTours();
    }
  }, [segment, fetchTours]);

  const groups = useMemo(() => {
    if (segment === 'tours') return [];
    if (segment === 'done') return [{ title: null, items }];
    const ofKind = items.filter((item) => item.type === SEGMENT_KIND[segment]);
    return groupBySchedule(ofKind, todayIso()).map((bucket) => ({
      title: SCHEDULE_GROUP_LABEL[bucket.group],
      items: bucket.items,
    }));
  }, [items, segment]);

  const open = (item: StaffInspection) => {
    if (item.type === 'MAINTENANCE') {
      onOpenMaintenance?.(item.id);
      return;
    }
    if (item.contract) onOpen(item.contract.id);
    else Alert.alert('Không mở được', 'Biên bản này chưa gắn với hợp đồng nào.');
  };

  const isEmpty =
    segment === 'tours' ? tours.length === 0 : groups.every((group) => group.items.length === 0);
  const activeLoading = segment === 'tours' ? isToursLoading : isLoading;
  const activeError = segment === 'tours' ? toursError : error;

  const handleRefresh = () => {
    if (segment === 'tours') void fetchTours();
    else void refetch();
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={activeLoading && !isEmpty} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-title-md font-strong tracking-tight text-foreground">Hôm nay</Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          Lượt nhận kho, trả kho, bảo trì và các ca dẫn khách tham quan.
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
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
            label="Bảo trì"
            isSelected={segment === 'maintenance'}
            onPress={() => setSegment('maintenance')}
          />
          <ChipButton
            label="Dẫn khách"
            isSelected={segment === 'tours'}
            onPress={() => setSegment('tours')}
          />
          <ChipButton
            label="Đã xong"
            isSelected={segment === 'done'}
            onPress={() => setSegment('done')}
          />
        </View>

        {activeError ? (
          <View className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
            <Text className="font-body text-body-sm text-danger">{activeError}</Text>
          </View>
        ) : null}

        {activeLoading && isEmpty ? (
          <ActivityIndicator className="mt-12" />
        ) : isEmpty ? (
          <Text className="font-body mt-12 text-center text-body-sm text-muted">
            {segment === 'tours'
              ? 'Không có ca dẫn khách nào được gán.'
              : segment === 'done'
                ? 'Chưa có biên bản nào được chốt.'
                : segment === 'maintenance'
                  ? 'Không có kho nào cần kiểm tra bảo trì.'
                  : 'Không có lượt nào cần xử lý.'}
          </Text>
        ) : segment === 'tours' ? (
          <View className="mt-5 gap-3">
            {tours.map((t) => (
              <StaffTourListItem key={t.id} appointment={t} onPress={() => onOpenTour?.(t.id)} />
            ))}
          </View>
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
