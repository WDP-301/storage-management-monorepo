import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Button, useThemeColor } from 'heroui-native';
import { type RefObject, useCallback } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AreaPresetKey, BrowseCriteria } from '../../types/customer';
import { BrowseFiltersContent } from './BrowseFiltersContent';
import { clearFilters, countActiveFilters } from './browse-filters';
import type { LocationOption } from './location-options';

/** Space reserved under the scroll content so the pinned footer never covers the last row. */
const FOOTER_HEIGHT = 92;

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  criteria: BrowseCriteria;
  onChange: (criteria: BrowseCriteria) => void;
  provinceOptions: readonly LocationOption[];
  wardOptions: readonly LocationOption[];
  areaCounts: ReadonlyMap<AreaPresetKey, number>;
  priceCounts: ReadonlyMap<number | null, number>;
  startDateLabel: string;
  /** Units matching the current criteria, shown on the confirm button. */
  resultCount: number;
};

/**
 * Filters as a bottom sheet instead of an inline card, so the facility list owns the screen.
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
  areaCounts,
  priceCounts,
  startDateLabel,
  resultCount,
}: Props) {
  const insets = useSafeAreaInsets();
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);
  const activeCount = countActiveFilters(criteria);

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

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          className="flex-row gap-3 border-t border-border bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button
            className="flex-1"
            isDisabled={activeCount === 0}
            variant="tertiary"
            onPress={() => onChange(clearFilters(criteria))}
          >
            <Button.Label>Đặt lại</Button.Label>
          </Button>
          <Button className="flex-[2]" onPress={() => sheetRef.current?.dismiss()}>
            <Button.Label>Xem {resultCount} kho</Button.Label>
          </Button>
        </View>
      </BottomSheetFooter>
    ),
    [activeCount, criteria, insets.bottom, onChange, resultCount, sheetRef],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor }}
      enableDynamicSizing={false}
      enablePanDownToClose
      footerComponent={renderFooter}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      snapPoints={['80%']}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + insets.bottom }}
      >
        <View className="mb-4 px-4">
          <Text className="text-xl font-bold tracking-tight text-foreground">Bộ lọc</Text>
          <Text className="mt-1 text-xs leading-5 text-muted">
            Thay đổi được áp dụng ngay, số kho khớp hiện ở nút bên dưới.
          </Text>
        </View>

        <BrowseFiltersContent
          areaCounts={areaCounts}
          criteria={criteria}
          priceCounts={priceCounts}
          provinceOptions={provinceOptions}
          startDateLabel={startDateLabel}
          wardOptions={wardOptions}
          onChange={onChange}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
