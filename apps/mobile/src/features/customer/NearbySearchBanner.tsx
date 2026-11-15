import { View } from 'react-native';
import { WIDE_NEARBY_RADIUS_KM } from '../../../lib/places-api';
import { Button, InlineMessage, Text } from '../../components/ui';
import type { NearbySearch } from './use-nearby-search';

type Props = {
  search: NearbySearch | null;
  resultCount: number;
  isBusy: boolean;
  error: string | null;
  canWiden: boolean;
  onWiden: () => void;
};

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
        <View className="rounded-xl bg-danger-0 px-3.5 py-2.5">
          <InlineMessage message={error} type="error" />
        </View>
      ) : null}

      {isEmpty ? (
        <View className="items-center gap-2 rounded-2xl bg-bg-card px-5 py-8">
          <Text className="text-lead font-semibold text-text-primary">
            Không có kho trống trong {search.radiusKm} km
          </Text>
          <Text className="text-center text-body leading-5 text-text-secondary">
            {canWiden
              ? `Thử mở rộng phạm vi tìm lên ${WIDE_NEARBY_RADIUS_KM} km, hoặc nới bộ lọc.`
              : 'Thử địa điểm khác hoặc nới bộ lọc kích thước, giá.'}
          </Text>
          {canWiden ? (
            <Button
              className="mt-2"
              fullWidth={false}
              label={`Mở rộng ${WIDE_NEARBY_RADIUS_KM} km`}
              loading={isBusy}
              onPress={onWiden}
              size="sm"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
