import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useThemeColor } from 'heroui-native';
import { CaretDown, CaretLeft, CaretRight } from 'phosphor-react-native';
import { type RefObject, useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { fromIsoDate, latestStartIso, todayIso, toIsoDate } from '../../../lib/rental-schedule';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  selectedDate: string;
  onSelect: (date: string) => void;
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ACCENT = 'hsl(203 100% 30%)';

export function RentalDatePickerSheet({ sheetRef, selectedDate, onSelect }: Props) {
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = fromIsoDate(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const today = todayIso();
  const todayDate = fromIsoDate(today);
  const maxIso = latestStartIso(today);
  const maxDate = fromIsoDate(maxIso);

  const monthStart = toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
  const lastDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = (visibleMonth.getDay() + 6) % 7;
  const cellCount = Math.ceil((firstWeekday + lastDay) / 7) * 7;
  const maxMonthStart = toIsoDate(new Date(maxDate.getFullYear(), maxDate.getMonth(), 1));
  const todayMonthStart = toIsoDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const canGoPrevious = monthStart > todayMonthStart;
  const canGoNext = monthStart < maxMonthStart;
  const availableMonths = [todayMonthStart, maxMonthStart].filter(
    (month, index, months) => months.indexOf(month) === index,
  );

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

  const chooseDate = (iso: string) => {
    onSelect(iso);
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      snapPoints={['62%']}
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
        <Text className="font-display text-title-md text-foreground">
          Chọn ngày bắt đầu dọn vào
        </Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          Ngày đã chọn: {formatIsoDate(selectedDate)}
        </Text>
        <Text className="font-body mt-1 text-caption text-muted">
          Có thể chọn đến {formatIsoDate(maxIso)}
        </Text>

        <View className="mt-5 flex-row items-center justify-between">
          <Pressable
            accessibilityLabel="Tháng trước"
            accessibilityRole="button"
            disabled={!canGoPrevious}
            className="size-11 items-center justify-center rounded-full border border-border"
            style={{ opacity: canGoPrevious ? 1 : 0.35 }}
            onPress={() =>
              setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))
            }
          >
            <CaretLeft color={ACCENT} size={20} weight="bold" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn tháng"
            accessibilityState={{ expanded: monthPickerOpen }}
            className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
            onPress={() => setMonthPickerOpen((open) => !open)}
          >
            <Text className="font-strong text-body-md text-foreground">
              Tháng {visibleMonth.getMonth() + 1}/{visibleMonth.getFullYear()}
            </Text>
            <CaretDown color={ACCENT} size={16} weight="bold" />
          </Pressable>
          <Pressable
            accessibilityLabel="Tháng sau"
            accessibilityRole="button"
            disabled={!canGoNext}
            className="size-11 items-center justify-center rounded-full border border-border"
            style={{ opacity: canGoNext ? 1 : 0.35 }}
            onPress={() =>
              setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))
            }
          >
            <CaretRight color={ACCENT} size={20} weight="bold" />
          </Pressable>
        </View>

        {monthPickerOpen ? (
          <View className="mt-3 flex-row gap-2 rounded-xl bg-surface-secondary p-2">
            {availableMonths.map((monthIso) => {
              const month = fromIsoDate(monthIso);
              const selected = monthIso === monthStart;
              return (
                <Pressable
                  key={monthIso}
                  accessibilityRole="button"
                  accessibilityLabel={`Tháng ${month.getMonth() + 1}/${month.getFullYear()}`}
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center rounded-lg px-2 py-3 ${selected ? 'bg-accent' : 'bg-surface'}`}
                  onPress={() => {
                    setVisibleMonth(month);
                    setMonthPickerOpen(false);
                  }}
                >
                  <Text
                    className={`font-ui text-body-sm ${selected ? 'text-accent-foreground' : 'text-foreground'}`}
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
              <Text className="font-ui text-caption text-muted">{weekday}</Text>
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
                    selected ? 'bg-accent' : iso === today ? 'border border-accent' : ''
                  }`}
                  onPress={() => chooseDate(iso)}
                >
                  <Text
                    className={`font-ui text-body-sm ${
                      selected
                        ? 'text-accent-foreground'
                        : enabled
                          ? 'text-foreground'
                          : 'text-muted/40'
                    }`}
                  >
                    {day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          className="mt-4 self-center rounded-full bg-accent/10 px-4 py-2"
          onPress={() => chooseDate(today)}
        >
          <Text className="font-ui text-body-sm text-accent">Chọn hôm nay</Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
