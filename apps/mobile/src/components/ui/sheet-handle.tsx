import { View } from 'react-native';

/** Centered drag indicator pill atop bottom sheets. */
export function SheetHandle() {
  return (
    <View className="items-center pt-2.5 pb-1">
      <View className="h-1 w-10 rounded-full bg-charcoal-850" />
    </View>
  );
}
