import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CaretDown, CaretLeft, CaretRight } from 'phosphor-react-native';
import { type RefObject, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useBookingSettings } from '../../../lib/client-settings';
import { formatIsoDate } from '../../../lib/format-vi';
import {
  fromIsoDate,
  latestStartIso,
  monthStartsBetween,
  todayIso,
  toIsoDate,
} from '../../../lib/rental-schedule';
import { Button, colors, renderCoatBackdrop, Text } from '../../components/ui';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  selectedDate: string;
  onSelect: (date: string) => void;
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function RentalDatePickerSheet({ sheetRef, selectedDate, onSelect }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = fromIsoDate(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const { leadDays } = useBookingSettings();
  const today = todayIso();
  const todayDate = fromIsoDate(today);
  const maxIso = latestStartIso(leadDays, today);
  const maxDate = fromIsoDate(maxIso);

  const monthStart = toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
  const lastDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = (visibleMonth.getDay() + 6) % 7;
  const cellCount = Math.ceil((firstWeekday + lastDay) / 7) * 7;
  const maxMonthStart = toIsoDate(new Date(maxDate.getFullYear(), maxDate.getMonth(), 1));
  const todayMonthStart = toIsoDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const canGoPrevious = monthStart > todayMonthStart;
  const canGoNext = monthStart < maxMonthStart;
  const availableMonths = monthStartsBetween(today, maxIso);

  const chooseDate = (iso: string) => {
    onSelect(iso);
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderCoatBackdrop}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: colors.neutral[200], width: 40 }}
      snapPoints={['65%']}
      onChange={(index) => {
        if (index >= 0) {
          const validDate =
            selectedDate < today ? today : selectedDate > maxIso ? maxIso : selectedDate;
          if (validDate !== selectedDate) onSelect(validDate);
          const date = fromIsoDate(validDate);
          setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          setMonthPickerOpen(false);
        }
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text className="text-title font-bold text-text-primary">Chọn ngày bắt đầu dọn vào</Text>
        <Text className="mt-1 text-body-sm text-text-secondary tabular-nums">
          Ngày đã chọn: {formatIsoDate(selectedDate)}
        </Text>
        <Text className="mt-0.5 text-caption text-text-secondary tabular-nums">
          Có thể chọn đến {formatIsoDate(maxIso)}
        </Text>

        <View className="mt-5 flex-row items-center justify-between">
          <Pressable
            accessibilityLabel="Tháng trước"
            accessibilityRole="button"
            disabled={!canGoPrevious}
            className="size-10 items-center justify-center rounded-full border border-border-default bg-bg-card"
            style={{ opacity: canGoPrevious ? 1 : 0.35 }}
            onPress={() =>
              setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))
            }
          >
            <CaretLeft color={colors.semantic.iconBrand} size={20} weight="bold" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn tháng"
            accessibilityState={{ expanded: monthPickerOpen }}
            className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
            onPress={() => setMonthPickerOpen((open) => !open)}
          >
            <Text className="text-body-md font-semibold text-text-primary tabular-nums">
              Tháng {visibleMonth.getMonth() + 1}/{visibleMonth.getFullYear()}
            </Text>
            <CaretDown color={colors.semantic.iconBrand} size={16} weight="bold" />
          </Pressable>
          <Pressable
            accessibilityLabel="Tháng sau"
            accessibilityRole="button"
            disabled={!canGoNext}
            className="size-10 items-center justify-center rounded-full border border-border-default bg-bg-card"
            style={{ opacity: canGoNext ? 1 : 0.35 }}
            onPress={() =>
              setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))
            }
          >
            <CaretRight color={colors.semantic.iconBrand} size={20} weight="bold" />
          </Pressable>
        </View>

        {monthPickerOpen ? (
          <View className="mt-3 flex-row flex-wrap gap-2 rounded-2xl border border-border-default bg-bg-subtle p-2.5">
            {availableMonths.map((monthIso) => {
              const month = fromIsoDate(monthIso);
              const selected = monthIso === monthStart;
              return (
                <Pressable
                  key={monthIso}
                  accessibilityRole="button"
                  accessibilityLabel={`Tháng ${month.getMonth() + 1}/${month.getFullYear()}`}
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center rounded-xl px-2 py-2.5 ${
                    selected ? 'bg-action-primary' : 'bg-bg-card'
                  }`}
                  // A long lead window lists many months; wrap three to a row instead of squeezing.
                  style={{ minWidth: '30%' }}
                  onPress={() => {
                    setVisibleMonth(month);
                    setMonthPickerOpen(false);
                  }}
                >
                  <Text
                    className={`text-body-sm font-medium tabular-nums ${
                      selected ? 'text-text-inverse' : 'text-text-primary'
                    }`}
                  >
                    Tháng {month.getMonth() + 1}/{month.getFullYear()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View className="mt-4 flex-row">
          {WEEKDAYS.map((weekday) => (
            <View
              key={weekday}
              className="h-8 items-center justify-center"
              style={{ width: '14.2857%' }}
            >
              <Text className="text-caption font-medium text-text-secondary">{weekday}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {Array.from({ length: cellCount }, (_, index) => {
            const day = index - firstWeekday + 1;
            if (day < 1 || day > lastDay) {
              return <View key={`empty-${index}`} className="h-11" style={{ width: '14.2857%' }} />;
            }
            const iso = toIsoDate(
              new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day),
            );
            const enabled = iso >= today && iso <= maxIso;
            const selected = iso === selectedDate;
            const isToday = iso === today;
            return (
              <View
                key={iso}
                className="h-11 items-center justify-center"
                style={{ width: '14.2857%' }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ngày ${formatIsoDate(iso)}`}
                  accessibilityState={{ disabled: !enabled, selected }}
                  disabled={!enabled}
                  className={`size-10 items-center justify-center rounded-full ${
                    selected ? 'bg-action-primary' : isToday ? 'border border-action-primary' : ''
                  }`}
                  onPress={() => chooseDate(iso)}
                >
                  <Text
                    className={`text-body-sm tabular-nums ${
                      selected
                        ? 'font-semibold text-text-inverse'
                        : !enabled
                          ? 'text-text-disabled'
                          : isToday
                            ? 'font-semibold text-action-primary'
                            : 'font-medium text-text-primary'
                    }`}
                  >
                    {day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View className="mt-4 items-center">
          <Button
            fullWidth={false}
            label="Chọn hôm nay"
            size="sm"
            variant="secondary"
            onPress={() => chooseDate(today)}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
