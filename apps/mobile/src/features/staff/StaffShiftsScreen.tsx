import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { CalendarBlank, Clock, SignIn, SignOut } from 'phosphor-react-native';
import { useRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import {
  formatVietnamTime,
  shiftAttendanceHint,
  shiftStatusDisplay,
} from '../../../lib/staff-shift-state';
import {
  AlertSheet,
  Button,
  colors,
  Dashed,
  FlowScreen,
  InlineMessage,
  StatusPill,
  Text,
} from '../../components/ui';
import type { StaffShiftRecord } from '../../types/staff-shift-api';

type Props = {
  isStaff: boolean;
  weekOffset: number;
  range: { from: string; to: string };
  todayIso: string;
  nowMs: number;
  shifts: StaffShiftRecord[];
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  busyShiftId: string | null;
  onPrevWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
  onRefresh: () => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onBack: () => void;
};

const WEEKDAY_VN = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function dayHeading(iso: string, todayIso: string): string {
  const weekday = WEEKDAY_VN[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? '';
  const dateLabel = formatIsoDate(iso);
  return iso === todayIso ? `Hôm nay · ${weekday} (${dateLabel})` : `${weekday} · ${dateLabel}`;
}

export function StaffShiftsScreen({
  isStaff,
  weekOffset,
  range,
  todayIso,
  nowMs,
  shifts,
  isLoading,
  error,
  actionError,
  busyShiftId,
  onPrevWeek,
  onCurrentWeek,
  onNextWeek,
  onRefresh,
  onCheckIn,
  onCheckOut,
  onBack,
}: Props) {
  if (!isStaff) {
    return (
      <FlowScreen muted onBack={onBack} title="Ca làm việc & Chấm công" titleAlign="left">
        <View className="flex-1 justify-center bg-bg-muted px-4">
          <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-5">
            <InlineMessage
              message="Chức năng chấm công ca làm chỉ áp dụng cho tài khoản Nhân viên chi nhánh. Quản lý chi nhánh sắp lịch trực trên hệ thống web."
              type="warning"
            />
            <Button label="Quay lại" onPress={onBack} size="sm" variant="secondary" />
          </View>
        </View>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen muted onBack={onBack} title="Ca làm việc & Chấm công" titleAlign="left">
      <View className="border-b border-border-default bg-bg-page px-4 py-3">
        <View className="flex-row items-center justify-between gap-2">
          <Pressable
            accessibilityRole="button"
            className="rounded-full border border-border-default bg-bg-subtle px-3 py-1.5"
            onPress={onPrevWeek}
          >
            <Text className="text-caption font-semibold text-text-primary">← Tuần trước</Text>
          </Pressable>

          <Pressable accessibilityRole="button" className="items-center" onPress={onCurrentWeek}>
            <Text className="text-caption font-semibold text-text-link">
              {weekOffset === 0 ? 'Tuần này' : 'Về tuần này'}
            </Text>
            <Text className="text-caption text-text-secondary tabular-nums">
              {formatIsoDate(range.from).slice(0, 5)} – {formatIsoDate(range.to)}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="rounded-full border border-border-default bg-bg-subtle px-3 py-1.5"
            onPress={onNextWeek}
          >
            <Text className="text-caption font-semibold text-text-primary">Tuần sau →</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={isLoading && shifts.length > 0} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {actionError ? <InlineMessage message={actionError} type="error" /> : null}

        {error ? (
          <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
            <InlineMessage message={error} type="error" />
            <Button label="Thử lại" onPress={onRefresh} size="sm" variant="secondary" />
          </View>
        ) : null}

        {isLoading && shifts.length === 0 ? (
          <ActivityIndicator className="mt-8" color={colors.semantic.actionPrimary} />
        ) : null}

        {!isLoading && !error && shifts.length === 0 ? (
          <View className="items-center gap-2 rounded-[20px] border border-dashed border-border-strong bg-bg-card px-5 py-10">
            <CalendarBlank color={colors.semantic.textSecondary} size={32} />
            <Text className="text-center text-body-sm font-medium text-text-secondary">
              Bạn chưa có ca làm nào được xếp trong tuần này.
            </Text>
          </View>
        ) : null}

        {shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            busy={busyShiftId === shift.id}
            nowMs={nowMs}
            onCheckIn={() => onCheckIn(shift.id)}
            onCheckOut={() => onCheckOut(shift.id)}
            shift={shift}
            todayIso={todayIso}
          />
        ))}
      </ScrollView>
    </FlowScreen>
  );
}

function ShiftCard({
  shift,
  todayIso,
  nowMs,
  busy,
  onCheckIn,
  onCheckOut,
}: {
  shift: StaffShiftRecord;
  todayIso: string;
  nowMs: number;
  busy: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const status = shiftStatusDisplay(shift.status);
  const hint = shiftAttendanceHint(shift, nowMs);
  const isToday = shift.work_date === todayIso;
  const checkOutConfirmRef = useRef<BottomSheetModal>(null);

  return (
    <View
      className={`gap-3 rounded-[20px] border bg-bg-card p-4 ${
        isToday ? 'border-action-primary/40' : 'border-border-default'
      }`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-caption font-semibold text-text-link">
            {dayHeading(shift.work_date, todayIso)}
          </Text>
          <Text className="text-body-lg font-bold text-text-primary">
            {shift.shift_template_name ?? shift.shift_template_code ?? 'Ca làm việc'}
          </Text>
        </View>
        <StatusPill label={status.label} tone={status.tone} />
      </View>

      <View className="flex-row items-center gap-2 rounded-xl bg-bg-subtle px-3 py-2">
        <Clock color={colors.semantic.actionPrimary} size={16} weight="bold" />
        <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
          {formatVietnamTime(shift.start_at)} – {formatVietnamTime(shift.end_at)}
        </Text>
      </View>

      {shift.check_in_at || shift.check_out_at ? (
        <View className="flex-row flex-wrap gap-4 px-1">
          {shift.check_in_at ? (
            <View className="flex-row items-center gap-1.5">
              <SignIn color={colors.semantic.statusSuccess} size={15} weight="bold" />
              <Text className="text-caption text-text-secondary tabular-nums">
                Vào ca:{' '}
                <Text className="font-semibold text-text-primary">
                  {formatVietnamTime(shift.check_in_at)}
                </Text>
              </Text>
            </View>
          ) : null}
          {shift.check_out_at ? (
            <View className="flex-row items-center gap-1.5">
              <SignOut color={colors.semantic.statusSuccess} size={15} weight="bold" />
              <Text className="text-caption text-text-secondary tabular-nums">
                Tan ca:{' '}
                <Text className="font-semibold text-text-primary">
                  {formatVietnamTime(shift.check_out_at)}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {shift.note ? (
        <Text className="text-caption text-text-secondary">Ghi chú: {shift.note}</Text>
      ) : null}

      {hint ? (
        <>
          <Dashed />
          {hint.kind === 'check-in' ? (
            <Button
              disabled={busy}
              fullWidth
              label={busy ? 'Đang check-in...' : 'Check-in vào ca'}
              loading={busy}
              onPress={onCheckIn}
              size="sm"
              variant="primary"
            />
          ) : hint.kind === 'check-out' ? (
            <Button
              disabled={busy}
              fullWidth
              label={busy ? 'Đang check-out...' : 'Check-out tan ca'}
              loading={busy}
              onPress={() => checkOutConfirmRef.current?.present()}
              size="sm"
              variant="secondary"
            />
          ) : (
            <Text className="text-caption text-text-secondary">{hint.text}</Text>
          )}
        </>
      ) : null}

      <AlertSheet
        ref={checkOutConfirmRef}
        message="Xác nhận kết thúc ca làm việc của bạn?"
        onPrimary={onCheckOut}
        onSecondary={() => checkOutConfirmRef.current?.dismiss()}
        primaryLabel="Đồng ý"
        secondaryLabel="Hủy"
        title="Check-out tan ca?"
      />
    </View>
  );
}
