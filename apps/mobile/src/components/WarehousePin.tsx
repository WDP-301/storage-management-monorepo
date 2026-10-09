import { Text, View } from 'react-native';
import { formatMoney, formatMoneyShort } from '../../lib/format-vi';

type Props = {
  monthlyPrice: number;
  isSelected: boolean;
  /** Warehouse already in the customer's booking selection. */
  isPicked?: boolean;
};

/**
 * Map marker for one warehouse, labelled with its monthly price.
 *
 * Someone scanning a map is deciding where to look next, and "6,5tr" answers that. Drawn as a pill
 * so the number sits inside the shape at a readable size; the stem underneath keeps the marker
 * anchored to a spot — `<Marker anchor="bottom">` puts that tip on the coordinates.
 */
export function WarehousePin({ monthlyPrice, isSelected, isPicked = false }: Props) {
  const highlighted = isSelected || isPicked;
  return (
    <View className="items-center">
      <View
        className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5 ${
          highlighted ? 'border-accent bg-foreground' : 'border-border bg-surface'
        }`}
      >
        <View className={`size-2 rounded-full ${isPicked ? 'bg-accent' : 'bg-success'}`} />
        <Text
          className={`font-numeric-strong text-num-sm ${
            highlighted ? 'text-accent-foreground' : 'text-foreground'
          }`}
        >
          {/* The selected pin has room for the exact figure; the rest stay abbreviated. */}
          {isSelected ? formatMoney(monthlyPrice) : formatMoneyShort(monthlyPrice)}
        </Text>
      </View>
      <View className={`h-2 w-0.5 ${highlighted ? 'bg-accent' : 'bg-border-strong'}`} />
    </View>
  );
}
