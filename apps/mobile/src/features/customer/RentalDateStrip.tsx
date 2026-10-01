import { Pressable, ScrollView, Text } from 'react-native';
import type { RentalDateOption } from '../../../lib/rental-schedule';

type Props = {
  options: readonly RentalDateOption[];
  selectedIso: string;
  onSelect: (iso: string) => void;
};

/**
 * Horizontal strip of selectable days.
 *
 * Starting at today is what rules out past dates — no validation needed, the option simply is not
 * there. A native date picker was avoided on purpose: it would add a dependency to open an OS
 * dialog for a range this short.
 */
export function RentalDateStrip({ options, selectedIso, onSelect }: Props) {
  return (
    <ScrollView
      contentContainerClassName="gap-2 px-4"
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {options.map((option) => (
        <DateCell
          key={option.iso}
          isSelected={option.iso === selectedIso}
          option={option}
          onPress={() => onSelect(option.iso)}
        />
      ))}
    </ScrollView>
  );
}

function DateCell({
  option,
  isSelected,
  onPress,
}: {
  option: RentalDateOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Ngày ${option.day}/${option.month}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={`w-16 items-center rounded-2xl border py-3 ${
        isSelected ? 'border-accent bg-accent' : 'border-border bg-surface'
      }`}
      onPress={onPress}
    >
      <Text
        className={`text-xs font-medium ${isSelected ? 'text-accent-foreground' : 'text-muted'}`}
      >
        {option.isToday ? 'Hôm nay' : option.weekday}
      </Text>
      <Text
        className={`mt-1 text-lg font-bold ${
          isSelected ? 'text-accent-foreground' : 'text-foreground'
        }`}
      >
        {option.day}
      </Text>
      <Text className={`text-xs ${isSelected ? 'text-accent-foreground' : 'text-muted'}`}>
        th{option.month.replace(/^0/, '')}
      </Text>
    </Pressable>
  );
}
