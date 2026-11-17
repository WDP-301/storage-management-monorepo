import type { TourAppointmentRecord } from '@storage/types';
import { Clock } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { todayIso } from '../../../lib/rental-schedule';
import { useSession } from '../../../lib/session';
import {
  formatVietnamTime,
  pickTodayActiveShift,
  shiftAttendanceHint,
  shiftStatusDisplay,
} from '../../../lib/staff-shift-state';
import { TourAppointmentsApi } from '../../../lib/tour-appointments-api';
import {
  Button,
  CardTabs,
  colors,
  FlowScreen,
  InlineMessage,
  StatusPill,
  TabChip,
  Text,
} from '../../components/ui';
import type { InspectionKind, StaffInspection } from '../../types/inspection-api';
import { InspectionListItem } from './InspectionListItem';
import { groupBySchedule, SCHEDULE_GROUP_LABEL } from './inspection-display';
import { StaffTourListItem } from './StaffTourListItem';
import { useStaffInspections } from './use-staff-inspections';
import { useStaffShifts } from './use-staff-shifts';

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
  onOpenShifts?: () => void;
};

/** Today tab: the handovers, returns, maintenance checks and tour appointments to carry out. */
export function StaffTodayScreen({ onOpen, onOpenTour, onOpenMaintenance, onOpenShifts }: Props) {
  const { user } = useSession();
  const isStaff = user?.roles.includes('FACILITY_STAFF') ?? false;
  const shifts = useStaffShifts(isStaff, 0);
  const todayShift = useMemo(
    () => pickTodayActiveShift(shifts.shifts, shifts.nowMs),
    [shifts.shifts, shifts.nowMs],
  );
  const shiftHint = todayShift ? shiftAttendanceHint(todayShift, shifts.nowMs) : null;
  const shiftBadge = todayShift ? shiftStatusDisplay(todayShift.status) : null;

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
    if (isStaff) shifts.refetch();
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

        {isStaff ? (
          <View className="gap-2.5 rounded-[20px] border border-border-default bg-bg-card p-4">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <Clock color={colors.semantic.actionPrimary} size={18} weight="bold" />
                <Text className="text-body font-bold text-text-primary">Ca làm hôm nay</Text>
              </View>
              {onOpenShifts ? (
                <Pressable accessibilityRole="button" onPress={onOpenShifts}>
                  <Text className="text-caption font-semibold text-text-link">Xem lịch tuần →</Text>
                </Pressable>
              ) : null}
            </View>

            {shifts.actionError ? (
              <InlineMessage message={shifts.actionError} type="error" />
            ) : null}

            {todayShift && shiftBadge ? (
              <>
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-body-sm font-semibold text-text-primary">
                      {todayShift.shift_template_name ??
                        todayShift.shift_template_code ??
                        'Ca làm việc'}
                    </Text>
                    <Text className="text-caption text-text-secondary tabular-nums">
                      {formatVietnamTime(todayShift.start_at)} –{' '}
                      {formatVietnamTime(todayShift.end_at)}
                    </Text>
                  </View>
                  <StatusPill label={shiftBadge.label} tone={shiftBadge.tone} />
                </View>

                {shiftHint?.kind === 'check-in' ? (
                  <Button
                    disabled={shifts.busyShiftId === todayShift.id}
                    fullWidth
                    label={
                      shifts.busyShiftId === todayShift.id ? 'Đang check-in...' : 'Check-in vào ca'
                    }
                    loading={shifts.busyShiftId === todayShift.id}
                    onPress={() => void shifts.checkIn(todayShift.id)}
                    size="sm"
                  />
                ) : shiftHint?.kind === 'check-out' ? (
                  <Button
                    disabled={shifts.busyShiftId === todayShift.id}
                    fullWidth
                    label={
                      shifts.busyShiftId === todayShift.id
                        ? 'Đang check-out...'
                        : 'Check-out tan ca'
                    }
                    loading={shifts.busyShiftId === todayShift.id}
                    onPress={() => void shifts.checkOut(todayShift.id)}
                    size="sm"
                    variant="secondary"
                  />
                ) : shiftHint ? (
                  <Text className="text-caption text-text-secondary">{shiftHint.text}</Text>
                ) : null}
              </>
            ) : shifts.isLoading ? (
              <Text className="text-caption text-text-secondary">Đang tải lịch ca...</Text>
            ) : shifts.error ? (
              <Text className="text-caption text-status-danger">{shifts.error}</Text>
            ) : (
              <Text className="text-caption text-text-secondary">
                Hôm nay bạn chưa được xếp ca trực.
              </Text>
            )}
          </View>
        ) : null}

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
