import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Button, Chip, useThemeColor } from 'heroui-native';
import { type RefObject, useCallback } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '../../../lib/format-vi';
import type { FacilityOffer, UnitOffer } from '../../types/customer';
import { sumUnitPrices } from './unit-offer-utils';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** `null` while nothing is tapped; the sheet renders empty rather than unmounting. */
  facility: FacilityOffer | null;
  requestedQuantity: number;
  hasHolding: boolean;
  onHold: (units: UnitOffer[]) => void;
};

/**
 * Facility detail for a tapped marker. Reuses the existing hold flow via `onHold`, so the map is a
 * second entry point into booking rather than a parallel implementation of it.
 */
export function FacilityMapSheet({
  sheetRef,
  facility,
  requestedQuantity,
  hasHolding,
  onHold,
}: Props) {
  const insets = useSafeAreaInsets();
  const [surfaceColor, mutedColor] = useThemeColor(['surface', 'muted']);

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

  const proposedUnits = facility ? facility.units.slice(0, requestedQuantity) : [];
  const isComplete = proposedUnits.length === requestedQuantity;

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      snapPoints={['42%']}
    >
      <BottomSheetView style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {facility ? (
          <View className="gap-4 px-4 pt-1">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bold text-foreground text-lg">{facility.name}</Text>
                <Text className="mt-1 text-muted text-xs leading-5">{facility.address}</Text>
              </View>
              <Chip color="accent" size="sm" variant="soft">
                <Chip.Label>{facility.units.length} kho trống</Chip.Label>
              </Chip>
            </View>

            <View className="flex-row justify-between gap-4 rounded-xl bg-surface-secondary p-3">
              <View className="flex-1">
                <Text className="text-muted text-xs">Giá từ</Text>
                <Text className="mt-1 font-bold text-foreground">
                  {formatMoney(facility.units[0]?.monthlyPrice ?? 0)}/tháng
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-muted text-xs">Tổng {proposedUnits.length} kho</Text>
                <Text className="mt-1 font-bold text-foreground">
                  {formatMoney(sumUnitPrices(proposedUnits, 'monthlyPrice'))}/tháng
                </Text>
              </View>
            </View>

            {isComplete ? (
              <Button
                isDisabled={hasHolding}
                onPress={() => {
                  // Dismissed first: `onHold` navigates to /schedule, and a sheet left open would
                  // sit on top of the new screen.
                  sheetRef.current?.dismiss();
                  onHold(proposedUnits);
                }}
              >
                <Button.Label>Chọn nhóm {requestedQuantity} kho</Button.Label>
              </Button>
            ) : (
              <Text className="text-muted text-xs leading-5">
                Cơ sở này chỉ còn {proposedUnits.length} kho. Giảm số kho cần thuê ở thanh lọc phía
                trên để tiếp tục.
              </Text>
            )}
          </View>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
