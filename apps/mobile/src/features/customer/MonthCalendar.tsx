import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { fromIsoDate, toIsoDate } from '../../../lib/rental-schedule';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ACCENT = 'hsl(203 100% 30%)';
const CELL_WIDTH = '14.2857%';

type Props = {
  minIso: string;
  maxIso: string;
  /** null = nothing chosen yet; the calendar then opens on `minIso`'s month. */
  selectedIso: string | null;
  /** A day to point out, e.g. the last day of the contract. */
  markedIso?: string | null;
  onSelect: (iso: string) => void;
};

const monthStartOf = (iso: string) => {
  const date = fromIsoDate(iso);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/** One month of selectable days between `minIso` and `maxIso`, with previous/next month buttons. */
export function MonthCalendar({ minIso, maxIso, selectedIso, markedIso, onSelect }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStartOf(selectedIso ?? minIso));
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthIso = toIsoDate(visibleMonth);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (visibleMonth.getDay() + 6) % 7;
  const cellCount = Math.ceil((firstWeekday + lastDate) / 7) * 7;
  const canGoPrevious = monthIso > toIsoDate(monthStartOf(minIso));
  const canGoNext = monthIso < toIsoDate(monthStartOf(maxIso));

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <MonthButton
          label="Tháng trước"
          enabled={canGoPrevious}
          onPress={() => setVisibleMonth(new Date(year, month - 1, 1))}
        >
          <CaretLeft color={ACCENT} size={20} weight="bold" />
        </MonthButton>
        <Text className="font-strong text-body-md text-foreground">
          Tháng {month + 1}/{year}
        </Text>
        <MonthButton
          label="Tháng sau"
          enabled={canGoNext}
          onPress={() => setVisibleMonth(new Date(year, month + 1, 1))}
        >
          <CaretRight color={ACCENT} size={20} weight="bold" />
        </MonthButton>
      </View>

      <View className="mt-4 flex-row">
        {WEEKDAYS.map((weekday) => (
          <View
            key={weekday}
            className="h-8 items-center justify-center"
            style={{ width: CELL_WIDTH }}
          >
            <Text className="font-ui text-caption text-muted">{weekday}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - firstWeekday + 1;
          if (day < 1 || day > lastDate) {
            return <View key={`empty-${index}`} className="h-11" style={{ width: CELL_WIDTH }} />;
          }
          const iso = toIsoDate(new Date(year, month, day));
          const enabled = iso >= minIso && iso <= maxIso;
          const selected = iso === selectedIso;
          const ring =
            iso === markedIso
              ? 'border border-warning'
              : iso === minIso
                ? 'border border-accent'
                : '';
          return (
            <View
              key={iso}
              className="h-11 items-center justify-center"
              style={{ width: CELL_WIDTH }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ngày ${formatIsoDate(iso)}`}
                accessibilityState={{ disabled: !enabled, selected }}
                disabled={!enabled}
                className={`size-10 items-center justify-center rounded-full ${selected ? 'bg-accent' : ring}`}
                onPress={() => onSelect(iso)}
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
    </View>
  );
}

function MonthButton({
  label,
  enabled,
  onPress,
  children,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={!enabled}
      className="size-11 items-center justify-center rounded-full border border-border"
      style={{ opacity: enabled ? 1 : 0.35 }}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}
