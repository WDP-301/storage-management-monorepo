import { Pressable } from 'react-native';

import { Text } from './text';

type Props = {
  label: string;
  count?: number;
  selected?: boolean;
  tone?: 'primary' | 'secondary' | 'surface';
  onPress?: () => void;
  testID?: string;
};

/** Pill filter/segment chip styled after Medipay TabChip and CardTabs. */
export function TabChip({
  label,
  count,
  selected = false,
  tone = 'secondary',
  onPress,
  testID,
}: Props) {
  const display = count !== undefined ? `${label} (${count})` : label;
  const activeBg = tone === 'primary' ? 'bg-primary-500' : 'bg-secondary-500';
  const idleBg = tone === 'surface' ? 'bg-bg-page border border-border-default' : 'bg-bg-subtle';

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      className={`items-center justify-center rounded-full px-4 py-1.5 ${
        selected ? (tone === 'surface' ? 'bg-primary-500' : activeBg) : idleBg
      }`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
      testID={testID}
    >
      <Text
        className={`text-body font-medium ${
          selected ? 'text-text-inverse' : 'text-text-secondary'
        }`}
        numberOfLines={1}
      >
        {display}
      </Text>
    </Pressable>
  );
}
