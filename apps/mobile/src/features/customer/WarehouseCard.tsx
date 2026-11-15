import { MapPin } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import { formatDimensions, formatMoney, formatNumber } from '../../../lib/format-vi';
import { displayMonthlyPrice, isShelfWarehouse } from '../../../lib/shelf-rental';
import { warehouseDeposit } from '../../../lib/warehouse-query';
import { Button, colors, Dashed, StatusPill, Text } from '../../components/ui';
import { WarehouseCover } from '../../components/WarehousePhotos';
import type { Warehouse } from '../../types/storage-api';

type Props = {
  warehouse: Warehouse;
  distanceKm?: number;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
  onOpen: () => void;
};

/** Size, volume, rent and deposit — figures customers compare between warehouses. */
export function WarehouseSpecs({ warehouse }: { warehouse: Warehouse }) {
  const specs = isShelfWarehouse(warehouse) ? shelfSpecs(warehouse) : unitSpecs(warehouse);
  return (
    <View className="gap-1.5">
      {specs.map(([label, value]) => (
        <View key={label} className="flex-row justify-between gap-3">
          <Text className="text-body text-text-secondary">{label}</Text>
          <Text className="flex-1 text-right text-body font-medium text-text-primary">{value}</Text>
        </View>
      ))}
    </View>
  );
}

function shelfSpecs(warehouse: Warehouse): [string, string][] {
  const summary = warehouse.shelfSummary;
  const { minAreaM2: min, maxAreaM2: max } = summary ?? {};
  const area =
    min == null || max == null
      ? null
      : min === max
        ? `${formatNumber(min)} m²`
        : `${formatNumber(min)} - ${formatNumber(max)} m²`;
  return [
    ['Kệ còn trống', `${summary?.available ?? 0}/${summary?.total ?? 0} kệ`],
    ...(area ? [['Diện tích mỗi kệ', area] as [string, string]] : []),
    ['Tiền cọc', 'Theo từng kệ'],
  ];
}

function unitSpecs(warehouse: Warehouse): [string, string][] {
  return [
    [
      'Kích thước (R × D × C)',
      formatDimensions(warehouse.widthM, warehouse.lengthM, warehouse.heightM),
    ],
    ['Diện tích', `${formatNumber(warehouse.areaM2)} m²`],
    ['Thể tích', warehouse.volumeM3 === null ? '—' : `${formatNumber(warehouse.volumeM3)} m³`],
    [
      'Tiền cọc',
      `${formatMoney(warehouseDeposit(warehouse))} (${warehouse.effectiveDepositMonths} tháng)`,
    ],
  ];
}

/** Medipay-styled warehouse card hiding internal warehouse codes from customers. */
export function WarehouseCard({
  warehouse,
  distanceKm,
  isSelected,
  isDisabled,
  onToggle,
  onOpen,
}: Props) {
  const isShelf = isShelfWarehouse(warehouse);
  const price = displayMonthlyPrice(warehouse);
  const availShelves = warehouse.shelfSummary?.available ?? 0;

  return (
    <Pressable
      accessibilityHint="Mở chi tiết kho"
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      <View
        className={`gap-3 rounded-2xl bg-bg-card p-4 ${
          isSelected
            ? 'border-2 border-border-selected bg-secondary-0/25'
            : 'border border-border-default'
        }`}
      >
        <WarehouseCover images={warehouse.images ?? []} name={warehouse.name} onPress={onOpen} />

        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <StatusPill
            label={isShelf ? `Kho kệ · ${availShelves} kệ trống` : 'Còn trống'}
            tone={isShelf ? 'info' : 'success'}
          />
          {distanceKm !== undefined ? (
            <StatusPill
              label={`Cách ${formatNumber(Math.round(distanceKm * 10) / 10)} km`}
              tone="neutral"
            />
          ) : (
            <View className="rounded-full bg-bg-subtle px-2.5 py-1">
              <Text className="text-caption font-medium text-text-secondary">
                {isShelf ? 'Thuê theo kệ' : `${formatNumber(warehouse.areaM2)} m²`}
              </Text>
            </View>
          )}
        </View>

        <View className="gap-1">
          <Text className="text-lead font-bold text-text-primary">{warehouse.name}</Text>
          <Text className="text-caption text-text-secondary" numberOfLines={1}>
            Thuộc {warehouse.facility.name}
          </Text>
          <View className="mt-0.5 flex-row items-start gap-1.5">
            <MapPin color={colors.semantic.textSecondary} size={14} weight="fill" />
            <Text className="flex-1 text-caption leading-4 text-text-secondary">
              {warehouse.addressLine}
            </Text>
          </View>
        </View>

        <Dashed />

        <WarehouseSpecs warehouse={warehouse} />
        {warehouse.notes ? (
          <Text className="text-caption text-text-secondary">{warehouse.notes}</Text>
        ) : null}

        <Dashed />

        <View className="flex-row items-center justify-between gap-3">
          <View>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-subtitle font-bold text-text-brand">
                {isShelf && price !== null ? 'Từ ' : ''}
                {price === null ? 'Liên hệ' : formatMoney(price)}
              </Text>
              {price !== null ? (
                <Text className="text-caption text-text-secondary">/tháng</Text>
              ) : null}
            </View>
            <Text className="text-caption font-medium text-text-link">Xem chi tiết ›</Text>
          </View>

          {isShelf ? (
            <Button
              fullWidth={false}
              label="Chọn kệ"
              leftIcon="view-carousel"
              onPress={onOpen}
              size="sm"
            />
          ) : (
            <Button
              disabled={isDisabled}
              fullWidth={false}
              label={isSelected ? 'Đã chọn' : 'Chọn thuê'}
              leftIcon={isSelected ? 'check' : 'add'}
              onPress={onToggle}
              size="sm"
              variant={isSelected ? 'secondary' : 'primary'}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}
