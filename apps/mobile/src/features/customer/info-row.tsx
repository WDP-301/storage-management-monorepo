import { Text, View } from 'react-native';

/** `isNumeric` sets money, dates and codes in the tabular figure font, like the rest of the app. */
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
      <Text className="font-body shrink-0 text-body-sm text-muted">{label}</Text>
      <Text
        className={`flex-1 text-right text-foreground ${
          isNumeric ? 'font-numeric text-num-md' : 'font-strong text-body-sm'
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
