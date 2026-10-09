import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Button, useThemeColor } from 'heroui-native';
import { ArrowRight, Check, MapPin, Plus } from 'phosphor-react-native';
import { type RefObject, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import type { FacilityOffer, UnitOffer } from '../../types/customer';
import { sumUnitPrices } from './unit-offer-utils';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  facility: FacilityOffer | null;
  requestedQuantity: number;
  selectedIds: readonly string[];
  allSelectedUnits: readonly UnitOffer[];
  hasHolding: boolean;
  onToggle: (unit: UnitOffer) => void;
  onHold: (units: UnitOffer[]) => void;
  onDismiss: () => void;
};

/** Facility details appear only after a pin is tapped. */
export function FacilityMapSheet({
  sheetRef,
  facility,
  requestedQuantity,
  selectedIds,
  allSelectedUnits,
  hasHolding,
  onToggle,
  onHold,
  onDismiss,
}: Props) {
  const [surface, muted, accent, onAccent] = useThemeColor([
    'surface',
    'muted',
    'accent',
    'accent-foreground',
  ]);
  const selectedUnits = facility?.units.filter((unit) => selectedIds.includes(unit.id)) ?? [];
  const otherSelectedCount = allSelectedUnits.length - selectedUnits.length;
  const selectedFacilityCount = new Set(allSelectedUnits.map((unit) => unit.facilityId)).size;
  const totalArea = allSelectedUnits.reduce((sum, unit) => sum + unit.areaM2, 0);
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

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: muted, width: 40 }}
      snapPoints={['55%', '92%']}
      onDismiss={onDismiss}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
        {facility ? (
          <View className="gap-3">
            {hasHolding ? (
              <Text className="rounded-lg bg-warning-bg p-3 font-body text-body-sm text-warning">
                Bạn đang có đơn giữ kho. Hoàn tất hoặc hủy đơn trong Đặt chỗ của tôi để chọn thêm.
              </Text>
            ) : null}
            <View className="gap-1.5">
              <View className="self-start rounded-full bg-success-bg px-2 py-1">
                <Text className="font-ui text-caption text-success">Cơ sở đang hoạt động</Text>
              </View>
              <Text className="font-strong text-foreground text-title-sm">{facility.name}</Text>
              <View className="flex-row items-start gap-1.5">
                <MapPin color={accent} size={16} weight="fill" />
                <Text className="flex-1 font-body text-body-sm text-subtle">
                  {facility.address}
                </Text>
              </View>
              <View className="self-start rounded-full bg-surface-secondary px-2.5 py-1">
                <Text className="font-ui text-body-sm text-subtle">
                  Còn {facility.units.length} kho trống phù hợp
                </Text>
              </View>
            </View>
            <View className="gap-2 border-separator border-t pt-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-ui text-caption text-muted uppercase">
                  Danh sách kho trống
                </Text>
                <Text className="font-body text-caption text-subtle">
                  Mục tiêu: {requestedQuantity} kho
                </Text>
              </View>
              {facility.units.map((unit) => {
                const isSelected = selectedIds.includes(unit.id);
                const disabled =
                  hasHolding || (!isSelected && selectedIds.length >= requestedQuantity);
                return (
                  <View
                    key={unit.id}
                    className="flex-row items-center gap-2 rounded-xl bg-surface-secondary p-3"
                  >
                    <View className="flex-1 gap-1">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="font-numeric text-foreground text-num-md">
                          {unit.code}
                        </Text>
                        <View className="rounded bg-surface px-1.5 py-0.5">
                          <Text className="font-numeric text-foreground text-num-sm">
                            {formatNumber(unit.areaM2)} m²
                          </Text>
                        </View>
                        {unit.zone ? (
                          <Text className="font-body text-caption text-muted">{unit.zone}</Text>
                        ) : null}
                      </View>
                      <Text className="font-body text-body-sm text-muted">{unit.dimensions}</Text>
                      {unit.notes ? (
                        <Text className="font-body text-body-sm text-muted">{unit.notes}</Text>
                      ) : null}
                      <Text className="font-numeric text-accent text-num-sm">
                        {formatMoney(unit.monthlyPrice)}
                        <Text className="font-body text-caption text-muted">/tháng</Text>
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${isSelected ? 'Bỏ chọn' : 'Chọn'} kho ${unit.code}`}
                      accessibilityState={{ checked: isSelected, disabled }}
                      disabled={disabled}
                      style={({ pressed }) => ({
                        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
                        minHeight: 44,
                        justifyContent: 'center',
                      })}
                      onPress={() => onToggle(unit)}
                    >
                      <View
                        className={`flex-row items-center gap-1 rounded-full px-3 py-2 ${isSelected ? 'bg-foreground' : 'bg-surface'}`}
                      >
                        {isSelected ? (
                          <Check color={onAccent} size={14} weight="bold" />
                        ) : (
                          <Plus color={muted} size={14} />
                        )}
                        <Text
                          className={`font-ui text-caption ${isSelected ? 'text-accent-foreground' : 'text-foreground'}`}
                        >
                          {isSelected ? 'Đã chọn' : 'Chọn thêm'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            {otherSelectedCount > 0 ? (
              <Text className="font-body text-body-sm text-muted">
                Đã chọn thêm {otherSelectedCount} kho ở cơ sở khác. Bạn có thể đặt các kho này cùng
                một lượt.
              </Text>
            ) : null}
            <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-secondary p-3">
              <View className="gap-1">
                <Text className="font-body text-caption text-muted">
                  Đã chọn tại {selectedFacilityCount} cơ sở
                </Text>
                <Text className="font-strong text-body-sm text-foreground">
                  {allSelectedUnits.length} kho / Tổng {formatNumber(totalArea)} m²
                </Text>
              </View>
              <View className="gap-1">
                <Text className="font-body text-caption text-muted">Tổng tiền thuê / tháng</Text>
                <Text className="font-numeric-strong text-accent text-num-lg">
                  {formatMoney(sumUnitPrices(allSelectedUnits, 'monthlyPrice'))}
                </Text>
              </View>
            </View>
            <Button
              isDisabled={hasHolding || allSelectedUnits.length !== requestedQuantity}
              onPress={() => onHold([...allSelectedUnits])}
            >
              <Button.Label className="font-ui">
                Tiếp tục đặt {allSelectedUnits.length}/{requestedQuantity} kho
              </Button.Label>
              <ArrowRight color={onAccent} size={18} weight="bold" />
            </Button>
          </View>
        ) : (
          <View className="gap-2 py-3">
            <Text className="font-strong text-body-lg text-foreground">
              Chưa có cơ sở trên bản đồ
            </Text>
            <Text className="font-body text-body-sm text-muted">
              Thử đổi bộ lọc hoặc xem các kho ở chế độ danh sách.
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
