import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { TourAppointmentRecord } from '@storage/types';
import { VIETNAMESE_PHONE_PATTERN } from '@storage/types';
import { Button, useThemeColor } from 'heroui-native';
import {
  CalendarBlank,
  Check,
  Clock,
  MapPin,
  Warehouse as WarehouseIcon,
  X,
} from 'phosphor-react-native';
import { type RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../../lib/api';
import { formatIsoDate } from '../../../lib/format-vi';
import { toIsoDate } from '../../../lib/rental-schedule';
import { useSession } from '../../../lib/session';
import { TourAppointmentsApi } from '../../../lib/tour-appointments-api';
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
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);

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

  // Autofill user profile when available
  useEffect(() => {
    if (user) {
      if (user.fullName) setFullName(user.fullName);
      if (user.phone) setPhone(user.phone);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handlePickDate = (iso: string) => {
    setPreferredDate(iso);
    setIsCalendarOpen(false);
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
    return null;
  };

  const handleSubmit = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      Alert.alert('Thông tin chưa hợp lệ', errorMsg);
      return;
    }
    if (!facility) return;

    setIsSubmitting(true);
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

      Alert.alert(
        'Đặt lịch thành công!',
        'Nhân viên chi nhánh sẽ sớm liên hệ để xác nhận và đón tiếp bạn.',
        [
          {
            text: 'Đồng ý',
            onPress: () => {
              sheetRef.current?.dismiss();
              onSuccess?.(created);
            },
          },
        ],
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Có lỗi xảy ra khi gửi yêu cầu.';
      Alert.alert('Không thể đặt lịch', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!facility) return null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['85%']}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: 'hsl(var(--surface))' }}
      handleIndicatorStyle={{ backgroundColor: 'hsl(var(--border))' }}
    >
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-1">
          <Text className="font-strong text-foreground text-title-md">
            Đặt lịch xem kho thực tế
          </Text>
          <Text className="font-body text-caption text-muted">
            Trải nghiệm trực tiếp không gian kho và tiện ích
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng"
          onPress={() => sheetRef.current?.dismiss()}
          className="size-8 items-center justify-center rounded-full bg-surface-secondary"
        >
          <X color={mutedColor} size={18} weight="bold" />
        </Pressable>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Facility & Target Warehouse Card */}
        <View className="mb-4 rounded-xl border border-border bg-surface-secondary p-3 gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <MapPin color={accentColor} size={16} weight="fill" />
            <Text className="font-strong text-body-sm text-foreground flex-1">{facility.name}</Text>
          </View>
          {facility.addressLine && (
            <Text className="font-body text-caption text-muted pl-5">{facility.addressLine}</Text>
          )}
          {storageUnit && (
            <View className="flex-row items-center gap-1.5 pt-1 border-t border-border/50">
              <WarehouseIcon color={accentColor} size={15} weight="bold" />
              <Text className="font-body text-caption text-foreground">
                Phòng kho mẫu:{' '}
                <Text className="font-strong">
                  {storageUnit.name} ({storageUnit.code})
                </Text>
              </Text>
            </View>
          )}
        </View>

        {/* Date Selection */}
        <View className="mb-4 gap-1.5">
          <Text className="font-strong text-body-sm text-foreground">
            Ngày muốn đến xem kho <Text className="text-warning">*</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2.5"
            onPress={() => setIsCalendarOpen((prev) => !prev)}
          >
            <CalendarBlank color={accentColor} size={18} weight="bold" />
            <Text className="flex-1 font-numeric text-body-sm text-foreground">
              {formatIsoDate(preferredDate)}
            </Text>
            <Text className="font-body text-caption text-accent">
              {isCalendarOpen ? 'Đóng lịch' : 'Đổi ngày'}
            </Text>
          </Pressable>

          {isCalendarOpen && (
            <View className="mt-2 rounded-xl border border-border bg-surface p-3">
              <MonthCalendar
                minIso={todayIso}
                maxIso={maxIso}
                selectedIso={preferredDate}
                onSelect={handlePickDate}
              />
            </View>
          )}
        </View>

        {/* Time Slot Selection */}
        <View className="mb-4 gap-1.5">
          <View className="flex-row items-center gap-1">
            <Clock color={accentColor} size={16} weight="bold" />
            <Text className="font-strong text-body-sm text-foreground">
              Khung giờ hẹn phù hợp <Text className="text-warning">*</Text>
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2 pt-1">
            {TIME_SLOTS.map((slot) => {
              const isSelected = preferredTimeSlot === slot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setPreferredTimeSlot(slot)}
                  className={`rounded-full border px-3 py-1.5 flex-row items-center gap-1 ${
                    isSelected ? 'border-accent bg-accent' : 'border-border bg-surface-secondary'
                  }`}
                >
                  {isSelected && <Check color="#fff" size={12} weight="bold" />}
                  <Text
                    className={`font-numeric text-caption ${
                      isSelected ? 'font-strong text-white' : 'text-foreground'
                    }`}
                  >
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Customer Information */}
        <View className="mb-4 gap-3">
          <Text className="font-strong text-body-sm text-foreground">
            Thông tin liên hệ của bạn
          </Text>

          <View className="gap-1">
            <Text className="font-body text-caption text-muted">
              Họ và tên <Text className="text-warning">*</Text>
            </Text>
            <BottomSheetTextInput
              className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground font-body"
              placeholder="Nhập họ và tên của bạn"
              placeholderTextColor={mutedColor}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View className="gap-1">
            <Text className="font-body text-caption text-muted">
              Số điện thoại <Text className="text-warning">*</Text>
            </Text>
            <BottomSheetTextInput
              className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground font-numeric"
              placeholder="VD: 0901234567"
              placeholderTextColor={mutedColor}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View className="gap-1">
            <Text className="font-body text-caption text-muted">
              Email <Text className="text-warning">*</Text>
            </Text>
            <BottomSheetTextInput
              className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground font-body"
              placeholder="VD: email@example.com"
              placeholderTextColor={mutedColor}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="gap-1">
            <Text className="font-body text-caption text-muted">Ghi chú thêm (không bắt buộc)</Text>
            <BottomSheetTextInput
              className="min-h-16 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground font-body"
              placeholder="Ví dụ: Cần kho lưu trữ đồ gia đình 3 tháng, muốn xem vị trí tầng 1..."
              placeholderTextColor={mutedColor}
              multiline
              value={customerNotes}
              onChangeText={setCustomerNotes}
            />
          </View>
        </View>

        {/* Action Button */}
        <Button variant="primary" isDisabled={isSubmitting} onPress={handleSubmit} className="mt-2">
          <Button.Label className="font-ui">
            {isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu đặt lịch hẹn'}
          </Button.Label>
        </Button>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
