import { View } from 'react-native';
import { Text } from '../../components/ui';

/** `isNumeric` sets money, dates and codes in tabular figures, matching Medipay key-value rows. */
export function InfoRow({
  label,
  value,
  isNumeric = false,
}: {
  label: string;
  value: string;
  isNumeric?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="shrink-0 text-body-sm text-text-secondary">{label}</Text>
      <Text
        className={`flex-1 text-right text-body-sm font-semibold text-text-primary ${
          isNumeric ? 'tabular-nums' : ''
        }`}
        // Long codes keep both ends visible; the tail is what staff read back over the phone.
        ellipsizeMode="middle"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
