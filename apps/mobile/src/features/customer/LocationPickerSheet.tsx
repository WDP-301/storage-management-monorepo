import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useThemeColor } from 'heroui-native';
import { Check, Crosshair, MagnifyingGlass, MapPin } from 'phosphor-react-native';
import { type ReactNode, type RefObject, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { NEARBY_RADIUS_KM, type PlacePrediction, PlacesApi } from '../../../lib/places-api';
import type { LocationOption } from './location-options';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  provinceOptions: readonly LocationOption[];
  /** `null` = "Tất cả kho"; ignored while `isNearbyActive`. */
  selectedProvinceCode: string | null;
  isNearbyActive: boolean;
  onNearMe: () => void;
  onChoosePlace: (place: PlacePrediction) => Promise<void>;
  onChooseProvince: (code: string | null) => void;
};

const ACCENT = 'hsl(203 100% 30%)';

/**
 * The single "where to look" picker: the customer's position, a searched place, or a province.
 * Opened from the area card above the list and from the search bar over the map.
 */
export function LocationPickerSheet({
  sheetRef,
  provinceOptions,
  selectedProvinceCode,
  isNearbyActive,
  onNearMe,
  onChoosePlace,
  onChooseProvince,
}: Props) {
  const [surface, muted] = useThemeColor(['surface', 'muted']);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSearching = query.trim().length >= 2;

  useEffect(() => {
    const input = query.trim();
    setPredictions([]);
    setError(null);
    if (input.length < 2) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    const timer = setTimeout(() => {
      PlacesApi.autocomplete(input, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setPredictions(results.filter((place) => place.place_id && place.description));
          }
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            setError(cause instanceof ApiError ? cause.message : 'Không tìm được địa điểm.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const choosePlace = async (place: PlacePrediction) => {
    if (isChoosing) return;
    setIsChoosing(true);
    setError(null);
    try {
      await onChoosePlace(place);
      sheetRef.current?.dismiss();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không tải được kho gần địa điểm này.');
    } finally {
      setIsChoosing(false);
    }
  };

  // GPS lookup can take seconds; close first so its progress shows on the screen underneath.
  const nearMe = () => {
    sheetRef.current?.dismiss();
    onNearMe();
  };
  const chooseProvince = (code: string | null) => {
    sheetRef.current?.dismiss();
    onChooseProvince(code);
  };

  const allCount = provinceOptions.reduce((sum, option) => sum + option.count, 0);

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surface }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: muted }}
      snapPoints={['75%']}
      onChange={(index) => {
        if (index >= 0) setQuery('');
      }}
    >
      <View className="px-4 pb-3">
        <Text className="font-display text-title-md text-foreground">Tìm kho ở đâu?</Text>
        <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-border bg-surface-secondary px-3">
          <MagnifyingGlass color={ACCENT} size={20} />
          <BottomSheetTextInput
            accessibilityLabel="Tìm địa điểm"
            autoCapitalize="none"
            autoCorrect={false}
            className="h-12 flex-1 font-body text-body-md text-foreground"
            placeholder="Nhập địa chỉ hoặc tên địa điểm"
            placeholderTextColor={muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
      >
        {isLoading || isChoosing ? <ActivityIndicator className="my-6" color={ACCENT} /> : null}
        {error ? <Text className="font-body py-3 text-body-sm text-danger">{error}</Text> : null}

        {isSearching ? (
          <>
            {!isLoading && !error && predictions.length === 0 ? (
              <Text className="font-body py-4 text-body-sm text-muted">
                Không có địa điểm phù hợp.
              </Text>
            ) : null}
            {predictions.map((place) => (
              <Row
                key={place.place_id}
                disabled={isChoosing}
                icon={<MapPin color={ACCENT} size={18} weight="fill" />}
                title={place.structured_formatting?.main_text ?? place.description}
                subtitle={place.structured_formatting?.secondary_text}
                onPress={() => void choosePlace(place)}
              />
            ))}
          </>
        ) : (
          <>
            <Row
              icon={<Crosshair color={ACCENT} size={18} weight="bold" />}
              title="Gần tôi"
              subtitle={`Dùng vị trí hiện tại, kho trong ${NEARBY_RADIUS_KM} km`}
              onPress={nearMe}
            />
            {provinceOptions.length > 0 ? (
              <>
                <Text className="mt-5 mb-1 font-ui text-caption text-muted uppercase">
                  Hoặc chọn tỉnh / thành phố
                </Text>
                <Row
                  isSelected={!isNearbyActive && selectedProvinceCode === null}
                  title="Tất cả kho"
                  subtitle={`${allCount} kho trống`}
                  onPress={() => chooseProvince(null)}
                />
                {provinceOptions.map((province) => (
                  <Row
                    key={province.code}
                    isSelected={!isNearbyActive && selectedProvinceCode === province.code}
                    title={province.name}
                    subtitle={`${province.count} kho trống`}
                    onPress={() => chooseProvince(province.code)}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function Row({
  icon,
  title,
  subtitle,
  isSelected = false,
  disabled = false,
  onPress,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  isSelected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      disabled={disabled}
      className="min-h-14 flex-row items-center gap-3 border-separator border-b py-3"
      onPress={onPress}
    >
      {icon ? (
        <View className="size-9 items-center justify-center rounded-full bg-accent/10">{icon}</View>
      ) : null}
      <View className="flex-1">
        <Text className="font-strong text-body-md text-foreground">{title}</Text>
        {subtitle ? (
          <Text className="font-body mt-0.5 text-body-sm text-muted">{subtitle}</Text>
        ) : null}
      </View>
      {isSelected ? <Check color={ACCENT} size={18} weight="bold" /> : null}
    </Pressable>
  );
}
