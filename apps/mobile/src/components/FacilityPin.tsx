import { Text, View } from 'react-native';
import { formatMoney, formatMoneyShort } from '../../lib/format-vi';

type Props = {
  /** Cheapest monthly price at this facility — the figure a customer compares across the map. */
  fromPrice: number;
  /** Available units at this facility. */
  count: number;
  isSelected: boolean;
};

/**
 * Map marker showing a facility's starting price.
 *
 * Price, not unit count. Someone scanning a map is deciding where to look next, and "550k" answers
 * that; "7 rooms" does not, because a facility with seven rooms they cannot afford is noise. The
 * unit count appears on every pin so availability can be compared too.
 *
 * Drawn as a pill rather than a teardrop so the number sits inside the shape at a readable size.
 * The pointer underneath keeps the marker anchored to a spot — `<Marker anchor="bottom">` puts that
 * tip on the coordinates.
 */
export function FacilityPin({ fromPrice, count, isSelected }: Props) {
  return (
    <View className="items-center">
      <View
        className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5 ${
          isSelected ? 'border-accent bg-foreground' : 'border-border bg-surface'
        }`}
      >
        <View className="size-2 rounded-full bg-success" />
        <Text
          className={`font-numeric-strong text-num-sm ${
            isSelected ? 'text-accent-foreground' : 'text-foreground'
          }`}
        >
          {/* The selected pin has room for the exact figure; the rest stay abbreviated so a cluster
              of pins does not turn into a wall of digits. */}
          {isSelected ? formatMoney(fromPrice) : formatMoneyShort(fromPrice)}
        </Text>
        <Text
          className={`font-ui text-caption ${isSelected ? 'text-accent-foreground' : 'text-muted'}`}
        >
          {count} kho
        </Text>
      </View>
      {/* Small stem so the pill reads as pinned to a point rather than floating over the map. */}
      <View className={`h-2 w-0.5 ${isSelected ? 'bg-accent' : 'bg-border-strong'}`} />
    </View>
  );
}
