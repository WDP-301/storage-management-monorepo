import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useThemeColor } from 'heroui-native';
import { MagnifyingGlass, MapPin } from 'phosphor-react-native';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { type PlacePrediction, PlacesApi } from '../../../lib/places-api';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  onChoose: (place: PlacePrediction) => Promise<void>;
};

const ACCENT = 'hsl(203 100% 30%)';

export function MapPlaceSearchSheet({ sheetRef, onChoose }: Props) {
  const [surface, muted] = useThemeColor(['surface', 'muted']);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const choose = async (place: PlacePrediction) => {
    if (isChoosing) return;
    setIsChoosing(true);
    setError(null);
    try {
      await onChoose(place);
      sheetRef.current?.dismiss();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không tải được kho gần địa điểm này.');
    } finally {
      setIsChoosing(false);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surface }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: muted }}
      snapPoints={['70%']}
      onChange={(index) => {
        if (index >= 0) setQuery('');
      }}
    >
      <View className="px-4 pb-3">
        <Text className="font-display text-title-md text-foreground">Tìm kho gần địa điểm</Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          Chọn một địa điểm để xem kho trống trong bán kính 5 km.
        </Text>
        <View className="mt-4 flex-row items-center gap-2 rounded-xl border border-border bg-surface-secondary px-3">
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
        {!isLoading && !error && query.trim().length >= 2 && predictions.length === 0 ? (
          <Text className="font-body py-4 text-body-sm text-muted">Không có địa điểm phù hợp.</Text>
        ) : null}
        {predictions.map((place) => (
          <Pressable
            key={place.place_id}
            accessibilityRole="button"
            disabled={isChoosing}
            className="flex-row items-start gap-3 border-separator border-b py-3"
            onPress={() => void choose(place)}
          >
            <View className="size-9 items-center justify-center rounded-full bg-accent/10">
              <MapPin color={ACCENT} size={18} weight="fill" />
            </View>
            <View className="flex-1">
              <Text className="font-strong text-body-md text-foreground">
                {place.structured_formatting?.main_text ?? place.description}
              </Text>
              {place.structured_formatting?.secondary_text ? (
                <Text className="font-body mt-0.5 text-body-sm text-muted">
                  {place.structured_formatting.secondary_text}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
