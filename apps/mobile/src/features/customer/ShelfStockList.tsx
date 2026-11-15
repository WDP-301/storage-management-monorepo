import type { ShelfItemView } from '@storage/types';
import { Text, View } from 'react-native';
import { quantityWithUnit, totalWithUnit } from '../../../lib/shelf-storage-format';

/** What is on the shelf right now, as counted by the counter staff. */
export function ShelfStockList({ items }: { items: ShelfItemView[] }) {
  // Items in different units have no meaningful sum, so the total row only shows for one unit.
  const total = items.length > 1 ? totalWithUnit(items) : null;
  if (items.length === 0) {
    return <Text className="font-body text-body-sm text-muted">Kệ trống</Text>;
  }
  return (
    <View className="gap-1.5">
      {items.map((item) => (
        <View key={item.id} className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 font-body text-body-md text-foreground">{item.name}</Text>
          <Text className="font-strong text-body-md text-foreground">
            ×{quantityWithUnit(item.quantity, item.unit)}
          </Text>
        </View>
      ))}
      {total ? (
        <View className="mt-1 flex-row items-center justify-between border-t border-border pt-2">
          <Text className="font-body text-body-sm text-muted">Tổng</Text>
          <Text className="font-strong text-body-md text-foreground">{total}</Text>
        </View>
      ) : null}
    </View>
  );
}
