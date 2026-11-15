import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { TourAppointmentRecord } from '@storage/types';
import { VIETNAMESE_PHONE_PATTERN } from '@storage/types';
import {
  CalendarBlank,
  CheckCircle,
  Clock,
  MapPin,
  Warehouse as WarehouseIcon,
  X,
} from 'phosphor-react-native';
import { type RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../../lib/api';
import { formatIsoDate } from '../../../lib/format-vi';
import { toIsoDate } from '../../../lib/rental-schedule';
import { useSession } from '../../../lib/session';
import { TourAppointmentsApi } from '../../../lib/tour-appointments-api';
import {
  Button,
  colors,
  InlineMessage,
  renderCoatBackdrop,
  TabChip,
  Text,
} from '../../components/ui';
import { MonthCalendar } from './MonthCalendar';

const TIME_SLOTS = [
  '08:30 - 09:30',
  '10:00 - 11:00',
  '14:00 - 15:00',
  '15:30 - 16:30',
  '17:00 - 18:00',
];

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  facility: { id: string; name: string; addressLine?: string } | null;
  storageUnit?: { id: string; name: string; code: string } | null;
  onSuccess?: (apt: TourAppointmentRecord) => void;
};

export function TourAppointmentSheet({ sheetRef, facility, storageUnit, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const maxIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toIsoDate(d);
  }, []);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredDate, setPreferredDate] = useState(todayIso);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState(TIME_SLOTS[1]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdApt, setCreatedApt] = useState<TourAppointmentRecord | null>(null);

  // Autofill user profile when available
  useEffect(() => {
    if (user) {
      if (user.fullName) setFullName(user.fullName);
      if (user.phone) setPhone(user.phone);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

  const isSlotPast = useCallback(
    (slot: string) => {
      if (preferredDate !== todayIso) return false;
      const match = /(\d{1,2}):(\d{2})/.exec(slot);
      if (!match) return false;
      const [slotHour, slotMinute] = [Number(match[1]), Number(match[2])];
      const now = new Date();
      const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const nowHour = vnNow.getUTCHours();
      const nowMinute = vnNow.getUTCMinutes();
      return nowHour > slotHour || (nowHour === slotHour && nowMinute >= slotMinute);
    },
    [preferredDate, todayIso],
  );

  const handlePickDate = (iso: string) => {
    setPreferredDate(iso);
    setIsCalendarOpen(false);
    setError(null);
  };

  const validate = (): string | null => {
    if (!facility) return 'Vui lòng chọn cơ sở chi nhánh.';
    if (!fullName.trim() || fullName.trim().length < 2) {
      return 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự).';
    }
    const cleanPhone = phone.trim();
    if (!cleanPhone || !VIETNAMESE_PHONE_PATTERN.test(cleanPhone)) {
      return 'Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).';
    }
    const cleanEmail = email.trim();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    if (!preferredDate || preferredDate < todayIso) {
      return 'Ngày hẹn không được ở trong quá khứ.';
    }
    if (isSlotPast(preferredTimeSlot)) {
      return 'Khung giờ này đã trôi qua. Vui lòng chọn khung giờ khác hoặc ngày khác.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      setError(errorMsg);
      return;
    }
    if (!facility) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await TourAppointmentsApi.create({
        facilityId: facility.id,
        storageUnitId: storageUnit?.id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        preferredDate,
        preferredTimeSlot,
        customerNotes: customerNotes.trim() || undefined,
      });
      setCreatedApt(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi xảy ra khi gửi yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeAfterSuccess = () => {
    const apt = createdApt;
    setCreatedApt(null);
    sheetRef.current?.dismiss();
    if (apt) onSuccess?.(apt);
  };

  if (!facility) return null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['88%']}
      backdropComponent={renderCoatBackdrop}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.semantic.bgCard }}
      handleIndicatorStyle={{ backgroundColor: colors.neutral[300] }}
      onDismiss={() => {
        setError(null);
        setCreatedApt(null);
      }}
    >
      <View className="flex-row items-center justify-between border-b border-border-default px-4 py-3">
        <View className="flex-1">
          <Text className="text-title font-bold text-text-primary">Đặt lịch xem kho thực tế</Text>
          <Text className="text-caption text-text-secondary">
            Trải nghiệm trực tiếp không gian kho và tiện ích
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng"
          onPress={() => sheetRef.current?.dismiss()}
          className="size-8 items-center justify-center rounded-full bg-bg-subtle"
        >
          <X color={colors.semantic.textSecondary} size={18} weight="bold" />
        </Pressable>
      </View>

      {createdApt ? (
        <View
          className="flex-1 items-center justify-center gap-4 px-6"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View className="size-16 items-center justify-center rounded-full bg-success-0">
            <CheckCircle color={colors.semantic.statusSuccess} size={36} weight="fill" />
          </View>
          <Text className="text-center text-title-sm font-bold text-text-primary">
            Đặt lịch thành công!
          </Text>
          <Text className="text-center text-body text-text-secondary">
            Nhân viên chi nhánh sẽ sớm liên hệ để xác nhận và đón tiếp bạn.
          </Text>
          <Button fullWidth label="Đồng ý" onPress={closeAfterSuccess} variant="primary" />
        </View>
      ) : (
        <BottomSheetScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 24) + 60,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1.5 rounded-2xl border border-border-default bg-bg-subtle p-3.5">
            <View className="flex-row items-center gap-1.5">
              <MapPin color={colors.semantic.iconBrand} size={16} weight="fill" />
              <Text className="flex-1 text-body-sm font-semibold text-text-primary">
                {facility.name}
              </Text>
            </View>
            {facility.addressLine ? (
              <Text className="pl-5 text-caption text-text-secondary">{facility.addressLine}</Text>
            ) : null}
            {storageUnit ? (
              <View className="flex-row items-center gap-1.5 border-t border-border-divider pt-2">
                <WarehouseIcon color={colors.semantic.actionPrimary} size={15} weight="bold" />
                <Text className="text-caption text-text-primary">
                  Phòng kho mẫu: <Text className="font-semibold">{storageUnit.name}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          <View className="gap-2">
            <Text className="text-body-sm font-semibold text-text-primary">
              Ngày muốn đến xem kho <Text className="text-status-danger">*</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center gap-2 rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3"
              onPress={() => setIsCalendarOpen((prev) => !prev)}
            >
              <CalendarBlank color={colors.semantic.actionPrimary} size={18} weight="bold" />
              <Text className="flex-1 text-body-sm font-medium text-text-primary tabular-nums">
                {formatIsoDate(preferredDate)}
              </Text>
              <Text className="text-caption font-medium text-text-link">
                {isCalendarOpen ? 'Đóng lịch' : 'Đổi ngày'}
              </Text>
            </Pressable>

            {isCalendarOpen ? (
              <View className="rounded-2xl border border-border-default bg-bg-card p-3.5">
                <MonthCalendar
                  minIso={todayIso}
                  maxIso={maxIso}
                  selectedIso={preferredDate}
                  onSelect={handlePickDate}
                />
              </View>
            ) : null}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Clock color={colors.semantic.actionPrimary} size={16} weight="bold" />
              <Text className="text-body-sm font-semibold text-text-primary">
                Khung giờ hẹn phù hợp <Text className="text-status-danger">*</Text>
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = preferredTimeSlot === slot;
                const isPast = isSlotPast(slot);
                if (isPast) {
                  return (
                    <View
                      key={slot}
                      className="rounded-full border border-border-default bg-bg-subtle px-3.5 py-1.5 opacity-40"
                    >
                      <Text className="text-caption text-text-secondary line-through tabular-nums">
                        {slot}
                      </Text>
                    </View>
                  );
                }
                return (
                  <TabChip
                    key={slot}
                    label={slot}
                    onPress={() => setPreferredTimeSlot(slot)}
                    selected={isSelected}
                    tone="primary"
                  />
                );
              })}
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-body-sm font-semibold text-text-primary">
              Thông tin liên hệ của bạn
            </Text>

            <View className="gap-1">
              <Text className="text-caption text-text-secondary">
                Họ và tên <Text className="text-status-danger">*</Text>
              </Text>
              <BottomSheetTextInput
                className="rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3 font-inter text-body text-text-primary"
                placeholder="Nhập họ và tên của bạn"
                placeholderTextColor={colors.semantic.textPlaceholder}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View className="gap-1">
              <Text className="text-caption text-text-secondary">
                Số điện thoại <Text className="text-status-danger">*</Text>
              </Text>
              <BottomSheetTextInput
                className="rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3 font-inter text-body text-text-primary tabular-nums"
                placeholder="VD: 0901234567"
                placeholderTextColor={colors.semantic.textPlaceholder}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View className="gap-1">
              <Text className="text-caption text-text-secondary">
                Email <Text className="text-status-danger">*</Text>
              </Text>
              <BottomSheetTextInput
                className="rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3 font-inter text-body text-text-primary"
                placeholder="VD: email@example.com"
                placeholderTextColor={colors.semantic.textPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View className="gap-1">
              <Text className="text-caption text-text-secondary">
                Ghi chú thêm (không bắt buộc)
              </Text>
              <BottomSheetTextInput
                className="min-h-16 rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3 font-inter text-body text-text-primary"
                placeholder="Ví dụ: Cần kho lưu trữ đồ gia đình 3 tháng, muốn xem vị trí tầng 1..."
                placeholderTextColor={colors.semantic.textPlaceholder}
                multiline
                value={customerNotes}
                onChangeText={setCustomerNotes}
              />
            </View>
          </View>

          {error ? <InlineMessage message={error} type="error" /> : null}

          <Button
            disabled={isSubmitting}
            fullWidth
            label={isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu đặt lịch hẹn'}
            loading={isSubmitting}
            onPress={() => void handleSubmit()}
          />
        </BottomSheetScrollView>
      )}
    </BottomSheetModal>
  );
}
