import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import {
  ArrowLeft,
  CalendarBlank,
  CaretRight,
  ShieldCheck,
  Warehouse as WarehouseIcon,
} from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { formatIsoDate, formatMoney, formatNumber } from '../../../lib/format-vi';
import type { RentalSchedule } from '../../../lib/hold';
import {
  DEFAULT_DURATION_MONTHS,
  DURATION_OPTIONS,
  rentalEndIso,
  todayIso,
} from '../../../lib/rental-schedule';
import { warehouseDeposit } from '../../../lib/warehouse-query';
import type { Warehouse } from '../../types/storage-api';
import { RentalDatePickerSheet } from './RentalDatePickerSheet';

type Props = {
  warehouses: Warehouse[];
  isCreating: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: (schedule: RentalSchedule) => void;
};

/** Mirror the colour tokens in global.css; SVG icons cannot read a Tailwind class. */
const ACCENT = 'hsl(203 100% 30%)';
const SUCCESS = 'hsl(160 84% 31%)';

/**
 * Rental terms, as a numbered step between picking warehouses and paying.
 *
 * The screen is one task per section — when, how long, what it costs — with the cost breakdown
 * last because it is the consequence of the two choices above it. The total due today is pinned so
 * it stays visible while the customer changes dates and durations.
 */
export function ScheduleRentalScreen({ warehouses, isCreating, error, onBack, onConfirm }: Props) {
  const [startDate, setStartDate] = useState(todayIso);
  const [durationMonths, setDurationMonths] = useState(DEFAULT_DURATION_MONTHS);
  const dateSheetRef = useRef<BottomSheetModal>(null);
  const endDate = rentalEndIso(startDate, durationMonths);

  const monthlyRent = warehouses.reduce((sum, item) => sum + item.monthlyPrice, 0);
  const deposit = warehouses.reduce((sum, item) => sum + warehouseDeposit(item), 0);
  const totalRent = monthlyRent * durationMonths;
  const totalArea = warehouses.reduce((sum, item) => sum + item.areaM2, 0);

  const warehouseNames = warehouses.map((item) => item.name).join(', ');

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between gap-3 px-4 pt-5 pb-3">
        <View className="flex-1 flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại chọn kho"
            disabled={isCreating}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: isCreating ? 0.4 : pressed ? 0.6 : 1 })}
            onPress={onBack}
          >
            <View className="size-10 items-center justify-center rounded-full">
              <ArrowLeft color={ACCENT} size={22} weight="bold" />
            </View>
          </Pressable>
          <Text className="flex-1 font-strong text-foreground text-title-md" numberOfLines={1}>
            Thời gian & Chi phí
          </Text>
        </View>
        <View className="rounded-full bg-surface-secondary px-2.5 py-1">
          <Text className="font-ui text-caption text-muted">Bước 2/3</Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
        {/* What is being booked, restated so the customer never has to go back to check. */}
        <View className="mx-4 flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <View className="size-10 items-center justify-center rounded-lg bg-accent/10">
            <WarehouseIcon color={ACCENT} size={20} weight="fill" />
          </View>
          <View className="flex-1">
            <Text className="font-strong text-body-md text-foreground" numberOfLines={1}>
              {warehouseNames}
            </Text>
            <Text className="font-body text-body-sm text-muted" numberOfLines={1}>
              {warehouses.length} kho, tổng {formatNumber(totalArea)} m²
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-numeric text-foreground text-num-md">
              {formatMoney(monthlyRent)}
            </Text>
            <Text className="font-body text-caption text-muted">mỗi tháng</Text>
          </View>
        </View>

        <SectionLabel text="Ngày bắt đầu dọn vào" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chọn ngày bắt đầu dọn vào, hiện tại ${formatIsoDate(startDate)}`}
          className="mx-4 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          onPress={() => dateSheetRef.current?.present()}
        >
          <View className="size-9 items-center justify-center rounded-lg bg-accent/10">
            <CalendarBlank color={ACCENT} size={20} weight="bold" />
          </View>
          <View className="flex-1">
            <Text className="font-strong text-body-md text-foreground">
              {startDate === todayIso() ? 'Hôm nay' : formatIsoDate(startDate)}
            </Text>
            <Text className="font-body text-caption text-muted">Chạm để chọn ngày trên lịch</Text>
          </View>
          <CaretRight color={ACCENT} size={18} weight="bold" />
        </Pressable>
        <View className="mx-4 mt-2 flex-row items-center justify-between gap-3 rounded-lg bg-surface-secondary px-3 py-2">
          <Text className="font-body text-body-sm text-muted">Nhận bàn giao kho</Text>
          <Text className="font-strong text-body-sm text-foreground">
            {formatIsoDate(startDate)}
          </Text>
        </View>

        <SectionLabel text="Thời hạn thuê dự kiến" />
        <View className="flex-row flex-wrap gap-2 px-4">
          {DURATION_OPTIONS.map((months) => (
            <ChoiceChip
              key={months}
              isSelected={durationMonths === months}
              label={`${months} tháng`}
              onPress={() => setDurationMonths(months)}
            />
          ))}
        </View>
        <Text className="font-body mt-2 px-4 text-body-sm text-muted">
          Thuê đến <Text className="font-strong text-foreground">{formatIsoDate(endDate)}</Text>
        </Text>

        <SectionLabel text="Chi tiết thanh toán" />
        <View className="mx-4 overflow-hidden rounded-xl border border-border bg-surface">
          {/* Each line says WHEN it is charged, not just how much. The rent line reading 0 đ is
              what stops someone believing the whole rental is due up front. */}
          <CostRow
            caption="Hoàn lại 100% khi trả kho"
            label={`Tiền cọc giữ ${warehouses.length} kho`}
            value={formatMoney(deposit)}
          />
          <View className="h-px bg-separator" />
          <CostRow
            caption={`Thu khi nhận kho (${formatIsoDate(startDate)})`}
            label="Tiền thuê tháng đầu"
            tone="success"
            value="0 đ"
          />
          <View className="h-px bg-separator" />
          <View className="flex-row items-center justify-between gap-3 bg-surface-secondary px-3 py-3">
            <Text className="font-strong text-body-md text-foreground">Cần thanh toán ngay</Text>
            <Text className="font-numeric-strong text-accent text-num-lg">
              {formatMoney(deposit)}
            </Text>
          </View>
        </View>

        <View className="mx-4 mt-3 flex-row items-start gap-2 rounded-lg bg-success-bg px-3 py-2.5">
          <ShieldCheck color={SUCCESS} size={16} weight="fill" />
          <Text className="flex-1 font-body text-body-sm text-success">
            Tiền cọc được giữ an toàn, hoàn lại 100% khi kết thúc hợp đồng.
          </Text>
        </View>

        <Text className="font-body mx-4 mt-3 text-body-sm text-muted">
          Tiền thuê {durationMonths} tháng là {formatMoney(totalRent)}, thu theo từng kỳ sau khi
          nhận kho.
        </Text>

        {error ? (
          <Text className="font-body mx-4 mt-3 text-body-sm text-danger">{error}</Text>
        ) : null}
      </ScrollView>

      <View className="shrink-0 flex-row items-center justify-between gap-3 border-border border-t bg-surface px-4 py-3">
        <View>
          <Text className="font-body text-caption text-muted">Cọc hôm nay</Text>
          <Text className="font-numeric-strong text-foreground text-num-lg">
            {formatMoney(deposit)}
          </Text>
        </View>
        <Button isDisabled={isCreating} onPress={() => onConfirm({ startDate, durationMonths })}>
          <Button.Label className="font-ui">
            {isCreating ? 'Đang giữ kho...' : 'Giữ chỗ & Lấy VietQR'}
          </Button.Label>
        </Button>
      </View>
      <RentalDatePickerSheet
        sheetRef={dateSheetRef}
        selectedDate={startDate}
        onSelect={setStartDate}
      />
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="font-ui mt-5 mb-2 px-4 text-caption text-muted uppercase tracking-wide">
      {text}
    </Text>
  );
}

function CostRow({
  label,
  caption,
  value,
  tone = 'default',
}: {
  label: string;
  caption: string;
  value: string;
  tone?: 'default' | 'success';
}) {
  return (
    <View className="flex-row items-start justify-between gap-3 px-3 py-3">
      <View className="flex-1">
        <Text className="font-body text-body-md text-foreground">{label}</Text>
        <Text className="font-body mt-0.5 text-caption text-muted">{caption}</Text>
      </View>
      <Text
        className={`font-numeric text-num-md ${
          tone === 'success' ? 'text-success' : 'text-foreground'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

/** Pill choice for rental duration. */
function ChoiceChip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View
        className={`rounded-full border px-3.5 py-2 ${
          isSelected ? 'border-foreground bg-foreground' : 'border-border bg-surface'
        }`}
      >
        <Text className={`font-ui text-body-sm ${isSelected ? 'text-surface' : 'text-subtle'}`}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
