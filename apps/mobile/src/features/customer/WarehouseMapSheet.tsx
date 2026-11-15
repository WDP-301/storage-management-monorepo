import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MapPin } from 'phosphor-react-native';
import type { RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { useBookingSettings } from '../../../lib/client-settings';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { displayMonthlyPrice, isShelfWarehouse } from '../../../lib/shelf-rental';
import {
  Button,
  colors,
  Dashed,
  InlineMessage,
  renderCoatBackdrop,
  StatusPill,
  Text,
} from '../../components/ui';
import { WarehousePhotoStrip } from '../../components/WarehousePhotos';
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
  onOpenDetail: (warehouse: Warehouse) => void;
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
  onOpenDetail,
}: Props) {
  const { maxUnitsPerBooking } = useBookingSettings();
  const isSelected = warehouse ? selected.some((item) => item.id === warehouse.id) : false;
  const isDisabled = hasHolding || (!isSelected && selected.length >= maxUnitsPerBooking);
  const totalArea = selected.reduce((sum, item) => sum + item.areaM2, 0);
  const totalRent = selected.reduce((sum, item) => sum + item.monthlyPrice, 0);
  const isShelf = warehouse ? isShelfWarehouse(warehouse) : false;

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
      handleIndicatorStyle={{ backgroundColor: colors.neutral[200], width: 40 }}
      snapPoints={['58%', '92%']}
      onDismiss={onDismiss}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {warehouse ? (
          <View className="gap-3.5">
            {hasHolding ? (
              <InlineMessage
                message="Bạn đang có đơn giữ kho. Hoàn tất hoặc hủy đơn trong Kho của tôi để chọn thêm."
                type="warning"
              />
            ) : null}

            <WarehousePhotoStrip images={warehouse.images ?? []} />

            <View className="flex-row items-center justify-between gap-2">
              {isShelf ? <StatusPill label="Thuê theo kệ" tone="info" /> : <View />}
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onOpenDetail(warehouse)}
              >
                <Text className="text-body-sm font-medium text-text-link">Xem chi tiết ›</Text>
              </Pressable>
            </View>

            <View className="gap-1.5">
              <Text className="text-title-sm font-bold text-text-primary">{warehouse.name}</Text>
              <Text className="text-caption text-text-secondary" numberOfLines={1}>
                Thuộc {warehouse.facility.name}
              </Text>
              <View className="flex-row items-start gap-1.5">
                <MapPin color={colors.semantic.iconBrand} size={16} weight="fill" />
                <Text className="flex-1 text-body-sm text-text-secondary">
                  {warehouse.addressLine}
                </Text>
              </View>
              <View className="mt-1 flex-row items-baseline gap-1">
                <Text className="text-subtitle font-bold text-text-brand tabular-nums">
                  {isShelf ? 'Từ ' : ''}
                  {displayMonthlyPrice(warehouse) === null
                    ? 'Liên hệ'
                    : formatMoney(displayMonthlyPrice(warehouse) ?? 0)}
                </Text>
                <Text className="text-caption text-text-secondary">/tháng</Text>
              </View>
            </View>

            <View className="gap-2 rounded-2xl border border-border-default bg-bg-subtle p-3.5">
              <WarehouseSpecs warehouse={warehouse} />
              {warehouse.notes ? (
                <Text className="text-body-sm text-text-secondary">{warehouse.notes}</Text>
              ) : null}
            </View>

            {isShelf ? (
              <View className="gap-2.5">
                <Button
                  disabled={hasHolding}
                  label="Chọn kệ trong kho này"
                  rightIcon="arrow-forward"
                  onPress={() => onOpenDetail(warehouse)}
                />
                {selected.length > 0 ? (
                  <>
                    <Dashed />
                    <SelectedSummaryBar
                      count={selected.length}
                      max={maxUnitsPerBooking}
                      totalArea={totalArea}
                      totalRent={totalRent}
                    />
                    <Button
                      disabled={hasHolding}
                      label={`Tiếp tục đặt ${selected.length} kho`}
                      variant="secondary"
                      onPress={onContinue}
                    />
                  </>
                ) : null}
              </View>
            ) : (
              <View className="gap-2.5">
                <Button
                  disabled={isDisabled}
                  label={isSelected ? 'Đã chọn kho này' : 'Chọn kho này'}
                  leftIcon={isSelected ? 'check' : 'add'}
                  variant={isSelected ? 'secondary' : 'outline'}
                  onPress={() => onToggle(warehouse)}
                />
                {selected.length > 0 ? (
                  <SelectedSummaryBar
                    count={selected.length}
                    max={maxUnitsPerBooking}
                    totalArea={totalArea}
                    totalRent={totalRent}
                  />
                ) : null}
                <Button
                  disabled={hasHolding || selected.length === 0}
                  label={`Tiếp tục đặt ${selected.length} kho`}
                  rightIcon="arrow-forward"
                  onPress={onContinue}
                />
              </View>
            )}
          </View>
        ) : (
          <View className="gap-2 py-4">
            <Text className="text-body-lg font-bold text-text-primary">
              Chưa có kho trên bản đồ
            </Text>
            <Text className="text-body-sm text-text-secondary">
              Thử đổi bộ lọc hoặc xem các kho ở chế độ danh sách.
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function SelectedSummaryBar({
  count,
  max,
  totalArea,
  totalRent,
}: {
  count: number;
  max: number;
  totalArea: number;
  totalRent: number;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-default bg-bg-subtle p-3.5">
      <View className="gap-0.5">
        <Text className="text-caption text-text-secondary tabular-nums">
          Đã chọn {count}/{max} kho
        </Text>
        <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
          Tổng {formatNumber(totalArea)} m²
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <Text className="text-caption text-text-secondary">Tổng tiền thuê / tháng</Text>
        <Text className="text-subtitle font-bold text-text-brand tabular-nums">
          {formatMoney(totalRent)}
        </Text>
      </View>
    </View>
  );
}
