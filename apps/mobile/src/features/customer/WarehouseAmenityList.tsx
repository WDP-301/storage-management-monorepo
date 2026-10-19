import { Text, View } from 'react-native';
import type { WarehouseAmenity } from '../../types/storage-api';

/** Amenity rows plus the "included in rent" footer; shared by warehouse and contract screens. */
export function AmenityItems({ amenities }: { amenities: readonly WarehouseAmenity[] }) {
  return (
    <View className="gap-1.5">
      <View className="gap-2 rounded-xl bg-surface-secondary p-3">
        {amenities.map((amenity) => (
          <View key={amenity.amenityId} className="gap-0.5">
            <View className="flex-row items-baseline gap-1.5">
              <Text className="font-ui text-body-sm text-foreground">{amenity.name}</Text>
              {amenity.quantity > 1 ? (
                <Text className="font-numeric text-caption text-muted">×{amenity.quantity}</Text>
              ) : null}
            </View>
            {amenity.note ? (
              <Text className="font-body text-caption text-muted">{amenity.note}</Text>
            ) : null}
          </View>
        ))}
      </View>
      <Text className="font-body text-caption text-muted">Đã bao gồm trong giá thuê</Text>
    </View>
  );
}

type Props = { amenities: readonly WarehouseAmenity[]; title: string };

/** Read-only list of the equipment a warehouse comes with; hidden when there is none. */
export function WarehouseAmenityList({ amenities, title }: Props) {
  if (amenities.length === 0) return null;

  return (
    <View className="gap-1.5">
      <Text className="font-strong text-body-sm text-foreground">{title}</Text>
      <AmenityItems amenities={amenities} />
    </View>
  );
}
