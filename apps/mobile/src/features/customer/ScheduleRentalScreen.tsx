import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { CalendarBlank, CaretRight } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useBookingSettings } from '../../../lib/client-settings';
import { formatIsoDate, formatMoney, formatNumber } from '../../../lib/format-vi';
import type { RentalSchedule } from '../../../lib/hold';
import { ReceivingSlotsApi } from '../../../lib/receiving-slots-api';
import type { ReceivingDay } from '../../../lib/receiving-time';
import {
  defaultInstant,
  formatVnTime,
  isWithinWindows,
  timeOptionsForDate,
} from '../../../lib/receiving-time';
import { latestStartIso, rentalEndIso, todayIso } from '../../../lib/rental-schedule';
import { rentalName } from '../../../lib/shelf-rental';
import { warehouseDeposit } from '../../../lib/warehouse-query';
import {
  Button,
  colors,
  Dashed,
  FlowScreen,
  InlineMessage,
  PayBar,
  ReviewItem,
  StatusPill,
  TabChip,
  Text,
} from '../../components/ui';
import type { Warehouse } from '../../types/storage-api';
import { RentalDatePickerSheet } from './RentalDatePickerSheet';

type Props = {
  warehouses: Warehouse[];
  isCreating: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: (schedule: RentalSchedule) => void;
};

/**
 * Rental terms, as a numbered step between picking warehouses and paying.
 *
 * The screen is one task per section — when, how long, what it costs — with the cost breakdown
 * last because it is the consequence of the two choices above it. The total due today is pinned so
 * it stays visible while the customer changes dates and durations.
 */
export function ScheduleRentalScreen({ warehouses, isCreating, error, onBack, onConfirm }: Props) {
  const { rentalMonthsOptions, defaultRentalMonths, minRentalMonths, maxRentalMonths, leadDays } =
    useBookingSettings();
  const [pickedStart, setStartDate] = useState(todayIso);
  const [pickedMonths, setPickedMonths] = useState(defaultRentalMonths);
  const [slots, setSlots] = useState<ReceivingDay[]>([]);
  const [requestedStartAt, setRequestedStartAt] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  // Rules can refresh while the screen is open. A pick the API still accepts is kept even when it is
  // no longer suggested; anything else is pulled back in, so the summary always shows what is sent.
  const latestStart = latestStartIso(leadDays);
  const startDate = pickedStart > latestStart ? latestStart : pickedStart;
  const durationMonths =
    pickedMonths >= minRentalMonths && pickedMonths <= maxRentalMonths
      ? pickedMonths
      : defaultRentalMonths;
  const durationChoices = rentalMonthsOptions.includes(durationMonths)
    ? rentalMonthsOptions
    : [...rentalMonthsOptions, durationMonths].sort((a, b) => a - b);
  const dateSheetRef = useRef<BottomSheetModal>(null);
  const endDate = rentalEndIso(startDate, durationMonths);
  const timeOptions = useMemo(() => timeOptionsForDate(slots, startDate), [slots, startDate]);
  // The pick only counts while it still falls inside the shown day's windows — after a date
  // change it is stale until the refetched slots replace it, so it must not be shown or sent.
  const receivingTime =
    requestedStartAt && isWithinWindows(slots, startDate, requestedStartAt)
      ? requestedStartAt
      : null;

  // The receiving time must fall inside an OFFICE window, so it is offered from the server's slots
  // rather than picked freely. Refetched whenever the chosen day changes.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingSlots(true);
    ReceivingSlotsApi.list(startDate, startDate)
      .then((days) => {
        if (cancelled) return;
        setSlots(days);
        setRequestedStartAt(defaultInstant(days, startDate));
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
        setRequestedStartAt(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate]);

  const monthlyRent = warehouses.reduce((sum, item) => sum + item.monthlyPrice, 0);
  const deposit = warehouses.reduce((sum, item) => sum + warehouseDeposit(item), 0);
  const totalRent = monthlyRent * durationMonths;
  const totalArea = warehouses.reduce((sum, item) => sum + item.areaM2, 0);

  const warehouseNames = warehouses.map(rentalName).join(', ');
  // A shelf has no handover: the first month is billed right after the deposit instead.
  const allShelves = warehouses.every((item) => item.kind === 'SHELF');
  const unitNoun = allShelves
    ? 'kệ'
    : warehouses.every((item) => item.kind === 'SELF_STORAGE')
      ? 'kho'
      : 'vị trí';

  return (
    <FlowScreen
      muted
      headerRight={<StatusPill label="Bước 2/3" tone="info" />}
      title="Thời gian & Chi phí"
      titleAlign="left"
      onBack={isCreating ? () => {} : onBack}
    >
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerClassName="gap-4 p-4 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* What is being booked, restated so the customer never has to go back to check. */}
        <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
          <ReviewItem
            icon="inventory-2"
            right={
              <View className="items-end">
                <Text className="text-body-md font-bold text-text-brand tabular-nums">
                  {formatMoney(monthlyRent)}
                </Text>
                <Text className="text-caption text-text-secondary">/tháng</Text>
              </View>
            }
            subtitle={`${warehouses.length} ${unitNoun} · tổng ${formatNumber(totalArea)} m²`}
            title={warehouseNames}
          />
        </View>

        <View className="gap-3.5 rounded-[20px] border border-border-default bg-bg-card p-4">
          <Text className="text-body-md font-semibold text-text-primary">Ngày bắt đầu dọn vào</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chọn ngày bắt đầu dọn vào, hiện tại ${formatIsoDate(startDate)}`}
            className="flex-row items-center gap-3 rounded-2xl border border-border-default bg-bg-subtle px-3.5 py-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            onPress={() => dateSheetRef.current?.present()}
          >
            <View className="size-10 items-center justify-center rounded-xl bg-secondary-0">
              <CalendarBlank color={colors.semantic.iconBrand} size={20} weight="bold" />
            </View>
            <View className="flex-1">
              <Text className="text-body-md font-semibold text-text-primary tabular-nums">
                {startDate === todayIso() ? 'Hôm nay' : formatIsoDate(startDate)}
              </Text>
              <Text className="text-caption text-text-secondary">Chạm để chọn ngày trên lịch</Text>
            </View>
            <CaretRight color={colors.semantic.iconBrand} size={18} weight="bold" />
          </Pressable>

          <View className="flex-row items-center justify-between gap-3 rounded-xl bg-bg-subtle px-3.5 py-2.5">
            <Text className="text-body-sm text-text-secondary">
              {allShelves ? 'Bắt đầu thuê' : 'Nhận bàn giao kho'}
            </Text>
            <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
              {receivingTime
                ? `${formatIsoDate(startDate)} · ${formatVnTime(receivingTime)}`
                : formatIsoDate(startDate)}
            </Text>
          </View>

          <Dashed />

          <Text className="text-body-md font-semibold text-text-primary">
            {allShelves ? 'Giờ bắt đầu' : 'Giờ nhận kho'}
          </Text>
          {isLoadingSlots ? (
            <Text className="text-body-sm text-text-secondary">Đang tải khung giờ…</Text>
          ) : timeOptions.length === 0 ? (
            <InlineMessage
              message="Ngày này không còn khung nhận kho. Vui lòng chọn ngày khác."
              type="error"
            />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {timeOptions.map((option) => (
                <TabChip
                  key={option.value}
                  label={option.label}
                  selected={requestedStartAt === option.value}
                  onPress={() => setRequestedStartAt(option.value)}
                />
              ))}
            </View>
          )}
        </View>

        <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
          <Text className="text-body-md font-semibold text-text-primary">
            Thời hạn thuê dự kiến
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {durationChoices.map((months) => (
              <TabChip
                key={months}
                label={`${months} tháng`}
                selected={durationMonths === months}
                onPress={() => setPickedMonths(months)}
              />
            ))}
          </View>
          <Text className="text-body-sm text-text-secondary tabular-nums">
            Thuê đến{' '}
            <Text className="font-semibold text-text-primary">{formatIsoDate(endDate)}</Text>
          </Text>
        </View>

        <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
          <Text className="text-body-md font-semibold text-text-primary">Chi tiết thanh toán</Text>
          <CostRow
            caption="Hoàn khi trả kho đúng hạn, sau khi trừ công nợ/phí phát sinh (nếu có)"
            label={`Tiền cọc giữ ${warehouses.length} ${unitNoun}`}
            value={formatMoney(deposit)}
          />
          <Dashed />
          <CostRow
            caption={
              allShelves
                ? 'Thanh toán sau khi cọc xong — chưa thu hôm nay'
                : 'Thanh toán khi nhận kho — chưa thu hôm nay'
            }
            label="Tiền thuê tháng đầu"
            value="0 đ"
          />
          <Dashed />
          <View className="flex-row items-center justify-between gap-3 rounded-xl bg-bg-subtle px-3.5 py-3">
            <Text className="text-body-md font-semibold text-text-primary">
              Cần thanh toán ngay
            </Text>
            <Text className="text-subtitle font-bold text-text-brand tabular-nums">
              {formatMoney(deposit)}
            </Text>
          </View>

          <InlineMessage
            message="Trả kho trước ngày hết hạn hợp đồng sẽ mất toàn bộ tiền cọc."
            type="info"
          />

          <Text className="text-caption text-text-secondary tabular-nums">
            Tổng tiền thuê dự kiến {durationMonths} tháng là {formatMoney(totalRent)}, thu theo từng
            kỳ.
          </Text>
        </View>
      </ScrollView>

      <PayBar
        amount={formatMoney(deposit)}
        caption="Chưa thu tiền thuê hôm nay"
        insetBottom
        label="Cọc giữ chỗ hôm nay"
      >
        {error ? <InlineMessage message={error} type="error" /> : null}
        <Button
          disabled={isCreating || !receivingTime}
          label={isCreating ? 'Đang giữ kho...' : 'Giữ chỗ & Lấy VietQR'}
          loading={isCreating}
          rightIcon="qr-code-2"
          onPress={() => {
            if (receivingTime) {
              onConfirm({ startDate, durationMonths, requestedStartAt: receivingTime });
            }
          }}
        />
      </PayBar>

      <RentalDatePickerSheet
        sheetRef={dateSheetRef}
        selectedDate={startDate}
        onSelect={setStartDate}
      />
    </FlowScreen>
  );
}

function CostRow({ label, caption, value }: { label: string; caption: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-body-md text-text-primary">{label}</Text>
        <Text className="mt-0.5 text-caption text-text-secondary">{caption}</Text>
      </View>
      <Text className="text-body-md font-semibold text-text-primary tabular-nums">{value}</Text>
    </View>
  );
}
