import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { TourAppointmentRecord } from '@storage/types';
import { TourAppointmentStatus } from '@storage/types';
import {
  CalendarBlank,
  CalendarCheck,
  CheckCircle,
  Clock,
  Envelope,
  MapPin,
  Phone,
  User,
  Warehouse,
  XCircle,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  AlertSheet,
  Button,
  colors,
  Dashed,
  FlowScreen,
  InlineMessage,
  TabChip,
  Text,
} from '../../components/ui';
import { StatusPill } from '../customer/contract-display';
import { formatTourDate, TOUR_STATUS_LABEL, TOUR_STATUS_TONE } from '../customer/tour-display';

type Props = {
  appointment: TourAppointmentRecord | null;
  isLoading: boolean;
  isSaving: boolean;
  error?: string | null;
  onComplete: (notes: string) => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  onRetry?: () => void;
  onBack: () => void;
};

export function StaffTourDetailScreen({
  appointment,
  isLoading,
  isSaving,
  error,
  onComplete,
  onCancel,
  onRetry,
  onBack,
}: Props) {
  const completeConfirmRef = useRef<BottomSheetModal>(null);
  const cancelConfirmRef = useRef<BottomSheetModal>(null);
  const [resultNotes, setResultNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelFormOpen, setIsCancelFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Route stays mounted between tour visits inside Tabs: reset form inputs on tour switch.
  const appointmentId = appointment?.id;
  useEffect(() => {
    setResultNotes('');
    setCancelReason('');
    setIsCancelFormOpen(false);
    setFormError(null);
  }, [appointmentId]);

  if (isLoading && !appointment) {
    return (
      <FlowScreen muted onBack={onBack} title="Chi tiết ca dẫn khách" titleAlign="left">
        <View className="flex-1 items-center justify-center bg-bg-muted">
          <ActivityIndicator color={colors.semantic.actionPrimary} size="large" />
        </View>
      </FlowScreen>
    );
  }

  if (!appointment) {
    return (
      <FlowScreen muted onBack={onBack} title="Chi tiết ca dẫn khách" titleAlign="left">
        <View className="flex-1 justify-center bg-bg-muted px-4">
          <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-5">
            <InlineMessage
              message={error || 'Ca dẫn khách này không tồn tại hoặc bạn không có quyền truy cập.'}
              type="error"
            />
            <View className="flex-row gap-2">
              {onRetry ? (
                <View className="flex-1">
                  <Button label="Tải lại" onPress={onRetry} size="sm" variant="secondary" />
                </View>
              ) : null}
              <View className="flex-1">
                <Button label="Quay lại" onPress={onBack} size="sm" variant="outline" />
              </View>
            </View>
          </View>
        </View>
      </FlowScreen>
    );
  }

  const isTerminal =
    appointment.status === TourAppointmentStatus.COMPLETED ||
    appointment.status === TourAppointmentStatus.CANCELLED;

  const handleCall = () => {
    setFormError(null);
    Linking.openURL(`tel:${appointment.phone}`).catch(() => {
      setFormError(`Không thể gọi tự động. Vui lòng quay số ${appointment.phone} thủ công.`);
    });
  };

  const handleCompleteSubmit = () => {
    if (!resultNotes.trim() || resultNotes.trim().length < 5) {
      setFormError('Vui lòng nhập ghi chú kết quả ca dẫn khách (tối thiểu 5 ký tự).');
      return;
    }
    setFormError(null);
    completeConfirmRef.current?.present();
  };

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) {
      setFormError('Vui lòng nhập lý do hủy ca hoặc lý do khách vắng mặt.');
      return;
    }
    setFormError(null);
    cancelConfirmRef.current?.present();
  };

  return (
    <FlowScreen muted onBack={onBack} title="Chi tiết ca dẫn khách" titleAlign="left">
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2.5">
              <View className="size-10 items-center justify-center rounded-full bg-secondary-0">
                <User color={colors.semantic.actionPrimary} size={20} weight="bold" />
              </View>
              <View className="flex-1">
                <Text className="text-body-lg font-bold text-text-primary">
                  {appointment.fullName}
                </Text>
                <Text className="text-caption text-text-secondary">Khách hàng tham quan</Text>
              </View>
            </View>

            <StatusPill
              label={TOUR_STATUS_LABEL[appointment.status]}
              tone={TOUR_STATUS_TONE[appointment.status]}
            />
          </View>

          <Dashed />

          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Phone color={colors.semantic.actionPrimary} size={16} weight="fill" />
              <Text className="text-body-sm font-medium text-text-primary tabular-nums">
                {appointment.phone}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleCall}
              className="flex-row items-center gap-1.5 rounded-full bg-action-primary px-3.5 py-1.5"
            >
              <Phone color={colors.semantic.textInverse} size={14} weight="fill" />
              <Text className="text-caption font-semibold text-text-inverse">Gọi ngay</Text>
            </Pressable>
          </View>

          {appointment.email ? (
            <View className="flex-row items-center gap-2">
              <Envelope color={colors.semantic.textSecondary} size={16} />
              <Text className="text-body-sm text-text-secondary">{appointment.email}</Text>
            </View>
          ) : null}
        </View>

        <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
          <Text className="text-lead font-bold text-text-primary">Thông tin ca tham quan</Text>
          <Dashed />

          <View className="flex-row items-center gap-2">
            <MapPin color={colors.semantic.iconBrand} size={18} weight="fill" />
            <Text className="flex-1 text-body-sm font-semibold text-text-primary">
              {appointment.facility?.name ?? 'Chi nhánh'}
            </Text>
          </View>

          {appointment.storageUnit ? (
            <View className="flex-row items-center gap-2 pl-6">
              <Warehouse color={colors.semantic.textSecondary} size={16} />
              <Text className="text-body-sm text-text-primary">
                Phòng kho mẫu:{' '}
                <Text className="font-semibold">
                  {appointment.storageUnit.name} ({appointment.storageUnit.code})
                </Text>
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-center gap-3 rounded-2xl bg-bg-subtle p-3">
            <View className="flex-1 flex-row items-center gap-2">
              <CalendarBlank color={colors.semantic.actionPrimary} size={18} weight="bold" />
              <View>
                <Text className="text-overline text-text-secondary">Ngày hẹn</Text>
                <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
                  {formatTourDate(appointment.preferredDate)}
                </Text>
              </View>
            </View>

            <View className="h-6 w-px bg-border-divider" />

            <View className="flex-1 flex-row items-center gap-2">
              <Clock color={colors.semantic.actionPrimary} size={18} weight="bold" />
              <View>
                <Text className="text-overline text-text-secondary">Khung giờ</Text>
                <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
                  {appointment.preferredTimeSlot || 'Chưa định giờ'}
                </Text>
              </View>
            </View>
          </View>

          {appointment.customerNotes ? (
            <View className="gap-1 rounded-2xl border border-border-default bg-bg-subtle p-3">
              <Text className="text-caption font-semibold text-text-secondary">
                Lời nhắn từ khách:
              </Text>
              <Text className="text-body-sm italic text-text-primary">
                "{appointment.customerNotes}"
              </Text>
            </View>
          ) : null}

          {appointment.managerNotes ? (
            <View className="gap-1 rounded-2xl bg-secondary-0 p-3">
              <Text className="text-caption font-semibold text-text-link">
                Dặn dò của Quản lý chi nhánh:
              </Text>
              <Text className="text-body-sm text-text-primary">{appointment.managerNotes}</Text>
            </View>
          ) : null}
        </View>

        {appointment.staffResultNotes ? (
          <View className="gap-2 rounded-[20px] border border-status-success/30 bg-success-0 p-4">
            <View className="flex-row items-center gap-2">
              <CheckCircle color={colors.semantic.statusSuccess} size={20} weight="fill" />
              <Text className="text-body font-bold text-status-success">
                Kết quả ca tư vấn dẫn khách
              </Text>
            </View>
            <Text className="text-body-sm text-text-primary">{appointment.staffResultNotes}</Text>
          </View>
        ) : null}

        {appointment.cancellationReason ? (
          <View className="gap-2 rounded-[20px] border border-status-danger/30 bg-danger-0 p-4">
            <View className="flex-row items-center gap-2">
              <XCircle color={colors.semantic.statusDanger} size={20} weight="fill" />
              <Text className="text-body font-bold text-status-danger">
                Lý do hủy / Báo vắng mặt (No-show)
              </Text>
            </View>
            <Text className="text-body-sm text-text-primary">{appointment.cancellationReason}</Text>
          </View>
        ) : null}

        {!isTerminal ? (
          <View className="gap-3">
            {formError ? <InlineMessage message={formError} type="error" /> : null}

            <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
              <View className="flex-row items-center gap-2">
                <CalendarCheck color={colors.semantic.actionPrimary} size={20} weight="bold" />
                <Text className="text-lead font-bold text-text-primary">
                  Ghi nhận kết quả sau ca dẫn
                </Text>
              </View>

              <Text className="text-caption text-text-secondary">
                Nhập phản hồi của khách, nhu cầu thuê và kết quả tư vấn để quản lý theo dõi.
              </Text>

              <TextInput
                className="min-h-24 rounded-xl border border-border-default bg-bg-subtle p-3.5 font-inter text-body text-text-primary"
                placeholder="VD: Khách rất ưng ý diện tích kho mẫu U-101, dự kiến thuê 6 tháng bắt đầu từ tuần tới..."
                placeholderTextColor={colors.semantic.textPlaceholder}
                multiline
                textAlignVertical="top"
                value={resultNotes}
                onChangeText={setResultNotes}
              />

              <Button
                disabled={isSaving || !resultNotes.trim()}
                fullWidth
                label={isSaving ? 'Đang lưu...' : 'Hoàn tất ca dẫn khách'}
                loading={isSaving}
                onPress={handleCompleteSubmit}
                variant="primary"
              />
            </View>

            {!isCancelFormOpen ? (
              <Button
                label="Khách không đến / Hủy ca dẫn khách"
                onPress={() => setIsCancelFormOpen(true)}
                variant="text"
              />
            ) : (
              <View className="gap-3 rounded-[20px] border border-warning-500/30 bg-bg-card p-4">
                <Text className="text-body-sm font-semibold text-text-primary">
                  Lý do báo vắng (No-show) hoặc hủy ca:
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  {['Khách hẹn lại hôm khác', 'Khách không bắt máy', 'Khách đổi ý không đến'].map(
                    (r) => (
                      <TabChip
                        key={r}
                        label={r}
                        onPress={() => setCancelReason(r)}
                        selected={cancelReason === r}
                        tone="secondary"
                      />
                    ),
                  )}
                </View>

                <TextInput
                  className="min-h-16 rounded-xl border border-border-default bg-bg-subtle p-3 font-inter text-body text-text-primary"
                  placeholder="Nhập chi tiết lý do..."
                  placeholderTextColor={colors.semantic.textPlaceholder}
                  multiline
                  textAlignVertical="top"
                  value={cancelReason}
                  onChangeText={setCancelReason}
                />

                <View className="flex-row justify-end gap-2">
                  <Button
                    disabled={isSaving}
                    label="Đóng"
                    onPress={() => setIsCancelFormOpen(false)}
                    size="sm"
                    variant="secondary"
                  />
                  <Button
                    disabled={isSaving || !cancelReason.trim()}
                    label="Xác nhận báo vắng"
                    loading={isSaving}
                    onPress={handleCancelSubmit}
                    size="sm"
                    variant="destructive"
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <AlertSheet
        ref={completeConfirmRef}
        message="Bạn có chắc chắn muốn lưu kết quả và đánh dấu ca dẫn khách này đã hoàn thành?"
        onPrimary={() => {
          completeConfirmRef.current?.dismiss();
          void onComplete(resultNotes.trim());
        }}
        onSecondary={() => completeConfirmRef.current?.dismiss()}
        primaryLabel="Hoàn tất"
        secondaryLabel="Quay lại"
        title="Xác nhận hoàn tất"
      />

      <AlertSheet
        ref={cancelConfirmRef}
        destructive
        message="Đánh dấu ca này là khách vắng mặt (No-show) hoặc hủy hẹn?"
        onPrimary={() => {
          cancelConfirmRef.current?.dismiss();
          void onCancel(cancelReason.trim());
        }}
        onSecondary={() => cancelConfirmRef.current?.dismiss()}
        primaryLabel="Xác nhận"
        secondaryLabel="Quay lại"
        title="Xác nhận hủy / Báo vắng"
      />
    </FlowScreen>
  );
}
