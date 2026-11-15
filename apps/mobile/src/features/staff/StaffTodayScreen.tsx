import type { TourAppointmentRecord } from '@storage/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { todayIso } from '../../../lib/rental-schedule';
import { TourAppointmentsApi } from '../../../lib/tour-appointments-api';
import {
  Button,
  CardTabs,
  colors,
  FlowScreen,
  InlineMessage,
  TabChip,
  Text,
} from '../../components/ui';
import type { InspectionKind, StaffInspection } from '../../types/inspection-api';
import { InspectionListItem } from './InspectionListItem';
import { groupBySchedule, SCHEDULE_GROUP_LABEL } from './inspection-display';
import { StaffTourListItem } from './StaffTourListItem';
import { useStaffInspections } from './use-staff-inspections';

type PrimaryTab = 'todo' | 'tours' | 'done';
type TodoKind = 'handover' | 'return' | 'maintenance';

const SEGMENT_KIND: Record<TodoKind, InspectionKind> = {
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
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('todo');
  const [todoKind, setTodoKind] = useState<TodoKind>('handover');

  const openInspections = useStaffInspections('open');
  const doneInspections = useStaffInspections('done');

  const [tours, setTours] = useState<TourAppointmentRecord[]>([]);
  const [isToursLoading, setIsToursLoading] = useState(false);
  const [toursLoaded, setToursLoaded] = useState(false);
  const [toursError, setToursError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const fetchTours = useCallback(async () => {
    setIsToursLoading(true);
    setToursError(null);
    try {
      const res = await TourAppointmentsApi.list({ limit: 50 });
      setTours(res.appointments);
      setToursLoaded(true);
    } catch {
      setToursError('Không tải được danh sách ca dẫn khách.');
    } finally {
      setIsToursLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTours();
  }, [fetchTours]);

  const counts = useMemo(() => {
    let handover = 0;
    let ret = 0;
    let maintenance = 0;
    for (const item of openInspections.items) {
      if (item.type === 'PRE_HANDOVER') handover += 1;
      else if (item.type === 'RETURN') ret += 1;
      else if (item.type === 'MAINTENANCE') maintenance += 1;
    }
    return {
      handover,
      ret,
      maintenance,
      todoTotal: handover + ret + maintenance,
    };
  }, [openInspections.items]);

  const groups = useMemo(() => {
    if (primaryTab === 'tours') return [];
    if (primaryTab === 'done') return [{ title: null, items: doneInspections.items }];
    const ofKind = openInspections.items.filter((item) => item.type === SEGMENT_KIND[todoKind]);
    return groupBySchedule(ofKind, todayIso()).map((bucket) => ({
      title: SCHEDULE_GROUP_LABEL[bucket.group],
      items: bucket.items,
    }));
  }, [doneInspections.items, openInspections.items, primaryTab, todoKind]);

  const open = (item: StaffInspection) => {
    setOpenError(null);
    if (item.type === 'MAINTENANCE') {
      onOpenMaintenance?.(item.id);
      return;
    }
    if (item.contract) onOpen(item.contract.id);
    else setOpenError('Biên bản này chưa gắn với hợp đồng nào.');
  };

  const isEmpty =
    primaryTab === 'tours' ? tours.length === 0 : groups.every((group) => group.items.length === 0);
  const activeLoading =
    primaryTab === 'tours'
      ? isToursLoading
      : primaryTab === 'done'
        ? doneInspections.isLoading
        : openInspections.isLoading;
  const activeError =
    primaryTab === 'tours'
      ? toursError
      : primaryTab === 'done'
        ? doneInspections.error
        : openInspections.error;

  const handleRefresh = () => {
    setOpenError(null);
    if (primaryTab === 'tours') void fetchTours();
    else if (primaryTab === 'done') void doneInspections.refetch();
    else void openInspections.refetch();
  };

  return (
    <FlowScreen muted showBack={false} title="Hôm nay" titleAlign="left">
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={activeLoading && !isEmpty} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-body-sm text-text-secondary">
          Lượt nhận kho, trả kho, bảo trì và các ca dẫn khách tham quan.
        </Text>

        <CardTabs
          onChange={setPrimaryTab}
          tabs={[
            {
              key: 'todo',
              label: 'Cần làm',
              count: !openInspections.error ? counts.todoTotal : undefined,
            },
            {
              key: 'tours',
              label: 'Dẫn khách',
              count: toursLoaded && !toursError ? tours.length : undefined,
            },
            {
              key: 'done',
              label: 'Đã xong',
              count: !doneInspections.error ? doneInspections.items.length : undefined,
            },
          ]}
          tone="surface"
          value={primaryTab}
        />

        {primaryTab === 'todo' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <TabChip
              count={counts.handover}
              label="Nhận kho"
              onPress={() => setTodoKind('handover')}
              selected={todoKind === 'handover'}
              tone="primary"
            />
            <TabChip
              count={counts.ret}
              label="Trả kho"
              onPress={() => setTodoKind('return')}
              selected={todoKind === 'return'}
              tone="primary"
            />
            <TabChip
              count={counts.maintenance}
              label="Bảo trì"
              onPress={() => setTodoKind('maintenance')}
              selected={todoKind === 'maintenance'}
              tone="primary"
            />
          </ScrollView>
        ) : null}

        {openError ? <InlineMessage message={openError} type="warning" /> : null}

        {activeError ? (
          <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
            <InlineMessage message={activeError} type="error" />
            <Button label="Thử lại" onPress={handleRefresh} size="sm" variant="secondary" />
          </View>
        ) : null}

        {activeLoading && isEmpty ? (
          <ActivityIndicator className="mt-8" color={colors.semantic.actionPrimary} />
        ) : !activeError && isEmpty ? (
          <View className="items-center rounded-[20px] border border-dashed border-border-strong bg-bg-card px-5 py-10">
            <Text className="text-center text-body-sm text-text-secondary">
              {primaryTab === 'tours'
                ? 'Không có ca dẫn khách nào được gán.'
                : primaryTab === 'done'
                  ? 'Chưa có biên bản nào được chốt.'
                  : todoKind === 'maintenance'
                    ? 'Không có kho nào cần kiểm tra bảo trì.'
                    : 'Không có lượt nào cần xử lý.'}
            </Text>
          </View>
        ) : primaryTab === 'tours' ? (
          <View className="gap-3">
            {tours.map((t) => (
              <StaffTourListItem key={t.id} appointment={t} onPress={() => onOpenTour?.(t.id)} />
            ))}
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.title ?? 'all'} className="gap-3">
              {group.title ? (
                <Text className="text-caption font-semibold text-text-secondary uppercase">
                  {group.title} · {group.items.length}
                </Text>
              ) : null}
              {group.items.map((item) => (
                <InspectionListItem key={item.id} inspection={item} onPress={() => open(item)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </FlowScreen>
  );
}
