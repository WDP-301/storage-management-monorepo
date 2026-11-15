import { TabChip } from './ui/tab-chip';

/** Single-choice pill styled after Medipay TabChip. */
export function ChoiceChip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return <TabChip label={label} onPress={onPress} selected={isSelected} tone="primary" />;
}
