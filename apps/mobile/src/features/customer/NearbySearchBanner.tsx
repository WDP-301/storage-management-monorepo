import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { WIDE_NEARBY_RADIUS_KM } from '../../../lib/places-api';
import type { NearbySearch } from './use-nearby-search';

type Props = {
  search: NearbySearch | null;
  /** Warehouses left after the size/price filters. */
  resultCount: number;
  isBusy: boolean;
  error: string | null;
  canWiden: boolean;
  onWiden: () => void;
};

/**
 * Feedback above the list for "Gần tôi" / place search: a failed lookup, or an empty radius with
 * the offer to widen it. The search itself is shown and cleared from the area card.
 */
export function NearbySearchBanner({
  search,
  resultCount,
  isBusy,
  error,
  canWiden,
  onWiden,
}: Props) {
  const isEmpty = search !== null && resultCount === 0;
  if (!error && !isEmpty) return null;

  return (
    <View className="mx-4 mt-3 gap-2">
      {error ? (
        <Text className="rounded-xl border border-danger/25 bg-danger-bg px-3 py-2 font-body text-body-sm text-danger">
          {error}
        </Text>
      ) : null}

      {isEmpty ? (
        <View className="items-center rounded-2xl border border-dashed border-border px-5 py-8">
          <Text className="font-strong text-foreground">
            Không có kho trống trong {search.radiusKm} km
          </Text>
          <Text className="font-body mt-1 text-center text-body-sm leading-5 text-muted">
            {canWiden
              ? `Thử mở rộng phạm vi tìm lên ${WIDE_NEARBY_RADIUS_KM} km, hoặc nới bộ lọc.`
              : 'Thử địa điểm khác hoặc nới bộ lọc kích thước, giá.'}
          </Text>
          {canWiden ? (
            <Button className="mt-3" isDisabled={isBusy} size="sm" onPress={onWiden}>
              <Button.Label className="font-ui">Mở rộng {WIDE_NEARBY_RADIUS_KM} km</Button.Label>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
