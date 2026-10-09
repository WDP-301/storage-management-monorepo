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
import { MAX_WAREHOUSES_PER_BOOKING } from '../../../lib/warehouse-query';
import type { Warehouse } from '../../types/storage-api';
import { WarehouseSpecs } from './WarehouseCard';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  warehouse: Warehouse | null;
  selected: readonly Warehouse[];
  hasHolding: boolean;
  onToggle: (warehouse: Warehouse) => void;
  onContinue: () => void;
  onDismiss: () => void;
};

/** Warehouse details appear only after a pin is tapped. */
export function WarehouseMapSheet({
  sheetRef,
  warehouse,
  selected,
  hasHolding,
  onToggle,
  onContinue,
  onDismiss,
}: Props) {
  const [surface, muted, accent, onAccent] = useThemeColor([
    'surface',
    'muted',
    'accent',
    'accent-foreground',
  ]);
  const isSelected = warehouse ? selected.some((item) => item.id === warehouse.id) : false;
  const isDisabled = hasHolding || (!isSelected && selected.length >= MAX_WAREHOUSES_PER_BOOKING);
  const totalArea = selected.reduce((sum, item) => sum + item.areaM2, 0);
  const totalRent = selected.reduce((sum, item) => sum + item.monthlyPrice, 0);
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
        {warehouse ? (
          <View className="gap-3">
            {hasHolding ? (
              <Text className="rounded-lg bg-warning-bg p-3 font-body text-body-sm text-warning">
                Bạn đang có đơn giữ kho. Hoàn tất hoặc hủy đơn trong Đặt chỗ của tôi để chọn thêm.
              </Text>
            ) : null}
            <View className="gap-1.5">
              <Text className="font-numeric text-caption text-muted">{warehouse.code}</Text>
              <Text className="font-strong text-foreground text-title-sm">{warehouse.name}</Text>
              <View className="flex-row items-start gap-1.5">
                <MapPin color={accent} size={16} weight="fill" />
                <Text className="flex-1 font-body text-body-sm text-subtle">
                  {warehouse.addressLine}
                </Text>
              </View>
              <View className="flex-row items-baseline gap-1">
                <Text className="font-numeric-strong text-accent text-num-lg">
                  {formatMoney(warehouse.monthlyPrice)}
                </Text>
                <Text className="font-body text-caption text-muted">/tháng</Text>
              </View>
            </View>
            <View className="gap-2 rounded-xl bg-surface-secondary p-3">
              <WarehouseSpecs warehouse={warehouse} />
              {warehouse.notes ? (
                <Text className="font-body text-body-sm text-muted">{warehouse.notes}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${isSelected ? 'Bỏ chọn' : 'Chọn'} kho ${warehouse.name}`}
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              disabled={isDisabled}
              style={({ pressed }) => ({ opacity: isDisabled ? 0.4 : pressed ? 0.7 : 1 })}
              onPress={() => onToggle(warehouse)}
            >
              <View
                className={`min-h-11 flex-row items-center justify-center gap-1.5 rounded-full px-3 py-2 ${isSelected ? 'bg-foreground' : 'bg-surface-secondary'}`}
              >
                {isSelected ? (
                  <Check color={onAccent} size={14} weight="bold" />
                ) : (
                  <Plus color={muted} size={14} />
                )}
                <Text
                  className={`font-ui text-body-sm ${isSelected ? 'text-accent-foreground' : 'text-foreground'}`}
                >
                  {isSelected ? 'Đã chọn kho này' : 'Chọn kho này'}
                </Text>
              </View>
            </Pressable>
            {selected.length > 0 ? (
              <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-secondary p-3">
                <View className="gap-1">
                  <Text className="font-body text-caption text-muted">
                    Đã chọn {selected.length}/{MAX_WAREHOUSES_PER_BOOKING} kho
                  </Text>
                  <Text className="font-strong text-body-sm text-foreground">
                    Tổng {formatNumber(totalArea)} m²
                  </Text>
                </View>
                <View className="gap-1">
                  <Text className="font-body text-caption text-muted">Tổng tiền thuê / tháng</Text>
                  <Text className="font-numeric-strong text-accent text-num-lg">
                    {formatMoney(totalRent)}
                  </Text>
                </View>
              </View>
            ) : null}
            <Button isDisabled={hasHolding || selected.length === 0} onPress={onContinue}>
              <Button.Label className="font-ui">Tiếp tục đặt {selected.length} kho</Button.Label>
              <ArrowRight color={onAccent} size={18} weight="bold" />
            </Button>
          </View>
        ) : (
          <View className="gap-2 py-3">
            <Text className="font-strong text-body-lg text-foreground">
              Chưa có kho trên bản đồ
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
