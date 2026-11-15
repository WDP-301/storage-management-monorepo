import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { MapPin } from 'phosphor-react-native';
import { useRef } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { displayMonthlyPrice, isShelfWarehouse } from '../../../lib/shelf-rental';
import {
  BottomBar,
  Button,
  colors,
  Dashed,
  FlowScreen,
  InlineMessage,
  StatusPill,
  Text,
} from '../../components/ui';
import { WarehouseGallery } from '../../components/WarehousePhotos';
import type { Warehouse } from '../../types/storage-api';
import { TourAppointmentSheet } from './TourAppointmentSheet';
import { WarehouseAmenityList } from './WarehouseAmenityList';
import { WarehouseSpecs } from './WarehouseCard';

type Props = {
  /** The warehouse shown; null keeps the page closed. */
  warehouse: Warehouse | null;
  distanceKm?: number;
  isSelected: boolean;
  isDisabled: boolean;
  hasHolding: boolean;
  onToggle: (warehouse: Warehouse) => void;
  onClose: () => void;
};

/**
 * Full-screen warehouse detail over Browse. A modal rather than a route, so the customer's
 * selection survives opening and closing it.
 */
export function WarehouseDetailScreen({
  warehouse,
  distanceKm,
  isSelected,
  isDisabled,
  hasHolding,
  onToggle,
  onClose,
}: Props) {
  const tourSheetRef = useRef<BottomSheetModal>(null);
  const isShelf = warehouse ? isShelfWarehouse(warehouse) : false;

  return (
    <Modal
      visible={warehouse !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {warehouse ? (
        <FlowScreen muted title="Chi tiết kho" titleAlign="left" withTopInset onBack={onClose}>
          <ScrollView
            className="flex-1 bg-bg-muted"
            contentContainerClassName="pb-6"
            showsVerticalScrollIndicator={false}
          >
            <WarehouseGallery images={warehouse.images ?? []} />

            <View className="gap-4 p-4">
              <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
                <View className="gap-1.5">
                  <Text className="text-title-sm font-bold text-text-primary">
                    {warehouse.name}
                  </Text>
                  <Text className="text-caption text-text-secondary">
                    Thuộc {warehouse.facility.name}
                  </Text>
                </View>

                <View className="flex-row items-start gap-1.5">
                  <MapPin color={colors.semantic.iconBrand} size={16} weight="fill" />
                  <Text className="flex-1 text-body-sm text-text-secondary">
                    {warehouse.addressLine}
                  </Text>
                </View>

                {distanceKm !== undefined ? (
                  <StatusPill
                    label={`Cách ${formatNumber(Math.round(distanceKm * 10) / 10)} km`}
                    tone="info"
                  />
                ) : null}

                <Dashed />

                <View className="flex-row items-baseline justify-between gap-2">
                  <Text className="text-caption text-text-secondary">Giá thuê hàng tháng</Text>
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-title font-bold text-text-brand tabular-nums">
                      {isShelf ? 'Từ ' : ''}
                      {displayMonthlyPrice(warehouse) === null
                        ? 'Liên hệ'
                        : formatMoney(displayMonthlyPrice(warehouse) ?? 0)}
                    </Text>
                    <Text className="text-caption text-text-secondary">/tháng</Text>
                  </View>
                </View>

                {!isShelf ? (
                  <View className="rounded-xl border border-border-default bg-bg-subtle p-3">
                    <WarehouseSpecs warehouse={warehouse} />
                  </View>
                ) : null}
              </View>

              <WarehouseAmenityList
                amenities={warehouse.amenities ?? []}
                // A shelf building's amenities are shared by every shelf in it, not owned by one tenant.
                title={isShelf ? 'Tiện ích chung của toà nhà' : 'Tiện ích có sẵn'}
              />

              {warehouse.notes ? (
                <View className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4">
                  <Text className="text-body-md font-semibold text-text-primary">Mô tả</Text>
                  <Text className="text-body-sm text-text-secondary">{warehouse.notes}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {!isShelf ? (
            <View className="bg-bg-card">
              {hasHolding ? (
                <View className="border-t border-border-default bg-warning-0 px-4 py-2.5">
                  <InlineMessage
                    message="Bạn đang có đơn giữ kho. Hoàn tất hoặc hủy đơn trong Kho của tôi để chọn thêm."
                    type="warning"
                  />
                </View>
              ) : null}
              <BottomBar insetBottom>
                <View className="flex-1">
                  <Button
                    label="Xem thực tế"
                    leftIcon="event"
                    variant="secondary"
                    onPress={() => tourSheetRef.current?.present()}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    disabled={isDisabled}
                    label={isSelected ? 'Bỏ chọn' : 'Chọn kho này'}
                    leftIcon={isSelected ? 'check' : 'add'}
                    variant={isSelected ? 'outline' : 'primary'}
                    onPress={() => onToggle(warehouse)}
                  />
                </View>
              </BottomBar>
            </View>
          ) : (
            <BottomBar insetBottom>
              <View className="flex-1">
                <Button
                  label="Đặt lịch xem kho thực tế"
                  leftIcon="event"
                  variant="secondary"
                  onPress={() => tourSheetRef.current?.present()}
                />
              </View>
            </BottomBar>
          )}

          <TourAppointmentSheet
            sheetRef={tourSheetRef}
            facility={warehouse?.facility ?? null}
            storageUnit={
              warehouse
                ? {
                    id: warehouse.id,
                    name: warehouse.name,
                    code: warehouse.code,
                  }
                : null
            }
          />
        </FlowScreen>
      ) : null}
    </Modal>
  );
}
