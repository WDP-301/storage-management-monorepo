import { View } from 'react-native';

import { Text } from './text';

type Props = {
  label?: string;
  className?: string;
};

/** Horizontal hairline divider, optionally centered with a short caption. */
export function Divider({ label, className = '' }: Props) {
  if (!label) {
    return <View className={`h-px bg-border-divider ${className}`} />;
  }

  return (
    <View className={`flex-row items-center gap-3 ${className}`}>
      <View className="h-px flex-1 bg-border-divider" />
      <Text className="text-caption text-text-secondary">{label}</Text>
      <View className="h-px flex-1 bg-border-divider" />
    </View>
  );
}

/** Dashed divider matching Medipay card receipts and key-value sections. */
export function DashedDivider({ className = '' }: { className?: string }) {
  return <View className={`border-t border-dashed border-border-divider ${className}`} />;
}
