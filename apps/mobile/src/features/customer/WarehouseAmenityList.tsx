import { View } from 'react-native';
import { Text } from '../../components/ui';
import type { WarehouseAmenity } from '../../types/storage-api';

/** Amenity rows plus the "included in rent" footer; shared by warehouse and contract screens. */
export function AmenityItems({ amenities }: { amenities: readonly WarehouseAmenity[] }) {
  return (
    <View className="gap-2">
      <View className="gap-2.5 rounded-2xl border border-border-default bg-bg-subtle p-3.5">
        {amenities.map((amenity) => (
          <View key={amenity.amenityId} className="gap-0.5">
            <View className="flex-row items-baseline gap-1.5">
              <Text className="text-body-sm font-medium text-text-primary">{amenity.name}</Text>
              {amenity.quantity > 1 ? (
                <Text className="text-caption font-medium text-text-secondary tabular-nums">
                  ×{amenity.quantity}
                </Text>
              ) : null}
            </View>
            {amenity.note ? (
              <Text className="text-caption text-text-secondary">{amenity.note}</Text>
            ) : null}
          </View>
        ))}
      </View>
      <Text className="text-caption text-text-secondary">Đã bao gồm trong giá thuê</Text>
    </View>
  );
}

type Props = { amenities: readonly WarehouseAmenity[]; title: string };

/** Read-only list of the equipment a warehouse comes with; hidden when there is none. */
export function WarehouseAmenityList({ amenities, title }: Props) {
  if (amenities.length === 0) return null;

  return (
    <View className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-body-md font-semibold text-text-primary">{title}</Text>
      <AmenityItems amenities={amenities} />
    </View>
  );
}
