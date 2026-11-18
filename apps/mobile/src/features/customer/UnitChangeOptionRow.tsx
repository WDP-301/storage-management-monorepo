import { Check } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import type { UnitChangeOption } from '../../../lib/change-requests-api';
import { formatArea, formatMoney } from '../../../lib/format-vi';
import { signedDifference } from '../../../lib/shelf-change';
import { colors, Text } from '../../components/ui';

/** Rent of a destination with its monthly difference, e.g. "1.200.000 ₫/tháng (+200.000 ₫/tháng)". */
export function optionRentText(option: UnitChangeOption): string {
  const difference = signedDifference(option.rent_difference, formatMoney);
  return `${formatMoney(option.unit.monthly_price)}/tháng${difference ? ` (${difference}/tháng)` : ''}`;
}

/** Extra deposit the customer must top up for this destination, when there is any. */
export function OptionDepositNote({ option }: { option: UnitChangeOption }) {
  return option.deposit_difference > 0 ? (
    <Text className="text-caption font-medium text-warning-700">
      Bù cọc thêm {formatMoney(option.deposit_difference)}
    </Text>
  ) : null;
}

/** One destination of a unit-change request as a tappable row. */
export function UnitChangeOptionRow({
  option,
  isSelected,
  onPress,
}: {
  option: UnitChangeOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={`flex-row items-center gap-3 rounded-2xl border px-3.5 py-3 ${
        isSelected ? 'border-border-selected bg-secondary-0' : 'border-border-default bg-bg-subtle'
      }`}
      onPress={onPress}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-body-sm font-semibold text-text-primary">{option.unit.name}</Text>
        <Text className="text-caption text-text-secondary">
          {option.unit.facility_name}
          {option.unit.area_m2 !== null ? ` · ${formatArea(option.unit.area_m2)}` : ''}
        </Text>
        <Text className="text-caption text-text-secondary tabular-nums">
          {optionRentText(option)}
        </Text>
        <OptionDepositNote option={option} />
      </View>
      {isSelected ? <Check color={colors.semantic.actionPrimary} size={20} weight="bold" /> : null}
    </Pressable>
  );
}
