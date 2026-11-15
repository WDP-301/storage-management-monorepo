import type { ShelfItemView } from '@storage/types';
import { View } from 'react-native';
import { quantityWithUnit, totalWithUnit } from '../../../lib/shelf-storage-format';
import { Dashed, Text } from '../../components/ui';

/** What is on the shelf right now, as counted by the counter staff. */
export function ShelfStockList({ items }: { items: ShelfItemView[] }) {
  // Items in different units have no meaningful sum, so the total row only shows for one unit.
  const total = items.length > 1 ? totalWithUnit(items) : null;
  if (items.length === 0) {
    return <Text className="text-body-sm text-text-secondary">Kệ trống</Text>;
  }
  return (
    <View className="gap-1.5">
      {items.map((item) => (
        <View key={item.id} className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-body text-text-primary">{item.name}</Text>
          <Text className="text-body font-semibold text-text-primary tabular-nums">
            ×{quantityWithUnit(item.quantity, item.unit)}
          </Text>
        </View>
      ))}
      {total ? (
        <>
          <Dashed className="mt-1" />
          <View className="flex-row items-center justify-between pt-1">
            <Text className="text-body-sm text-text-secondary">Tổng</Text>
            <Text className="text-body font-bold text-text-primary tabular-nums">{total}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
