import {
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { type RefObject, useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearFilters, countActiveFilters } from '../../../lib/warehouse-query';
import { Button, colors, renderCoatBackdrop, Text } from '../../components/ui';
import type { BrowseCriteria } from '../../types/customer';
import type { Amenity } from '../../types/storage-api';
import { BrowseFiltersContent } from './BrowseFiltersContent';
import type { LocationOption } from './location-options';

/** Space reserved under the scroll content so the pinned footer never covers the last row. */
const FOOTER_HEIGHT = 96;

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  criteria: BrowseCriteria;
  onChange: (criteria: BrowseCriteria) => void;
  provinceOptions: readonly LocationOption[];
  wardOptions: readonly LocationOption[];
  amenityOptions: readonly Amenity[];
  /** Warehouses matching the current criteria, shown on the confirm button. */
  resultCount: number;
};

/**
 * Filters as a bottom sheet instead of an inline card, so the warehouse list owns the screen.
 *
 * Changes apply live rather than being staged behind an "apply" step — the sheet covers the list,
 * so the running match count on the footer button is what gives the customer feedback. Swiping the
 * sheet down therefore keeps the changes, matching every other live filter in the app.
 */
export function BrowseFiltersSheet({
  sheetRef,
  criteria,
  onChange,
  provinceOptions,
  wardOptions,
  amenityOptions,
  resultCount,
}: Props) {
  const insets = useSafeAreaInsets();
  const activeCount = countActiveFilters(criteria);

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          className="flex-row gap-3 border-border-default border-t bg-bg-card px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="flex-1">
            <Button
              disabled={activeCount === 0}
              label="Đặt lại"
              variant="secondary"
              onPress={() => onChange(clearFilters(criteria))}
            />
          </View>
          <View className="flex-[2]">
            <Button label={`Xem ${resultCount} kho`} onPress={() => sheetRef.current?.dismiss()} />
          </View>
        </View>
      </BottomSheetFooter>
    ),
    [activeCount, criteria, insets.bottom, onChange, resultCount, sheetRef],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderCoatBackdrop}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      enableDynamicSizing={false}
      enablePanDownToClose
      footerComponent={renderFooter}
      handleIndicatorStyle={{ backgroundColor: colors.neutral[200], width: 40 }}
      snapPoints={['75%']}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + insets.bottom }}
      >
        <View className="mb-4 px-4">
          <Text className="text-title font-bold text-text-primary">Bộ lọc</Text>
          <Text className="mt-1 text-caption text-text-secondary">
            Thay đổi được áp dụng ngay, số kho khớp hiện ở nút bên dưới.
          </Text>
        </View>

        <BrowseFiltersContent
          criteria={criteria}
          provinceOptions={provinceOptions}
          wardOptions={wardOptions}
          amenityOptions={amenityOptions}
          onChange={onChange}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
