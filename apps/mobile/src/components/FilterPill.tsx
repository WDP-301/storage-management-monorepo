import { TabChip } from './ui/tab-chip';

/** Single-choice filter pill styled after Medipay TabChip. */
export function FilterPill({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return <TabChip label={label} onPress={onPress} selected={isSelected} tone="secondary" />;
}
