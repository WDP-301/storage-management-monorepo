import { CheckCircle, MapPin, Plus, Rows } from 'phosphor-react-native';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDimensions, formatMoney, formatNumber } from '../../../lib/format-vi';
import { displayMonthlyPrice, isShelfWarehouse } from '../../../lib/shelf-rental';
import { warehouseDeposit } from '../../../lib/warehouse-query';
import { WarehouseCover } from '../../components/WarehousePhotos';
import type { Warehouse } from '../../types/storage-api';

/** Mirror the colour tokens in global.css; SVG icons cannot read a Tailwind class. */
const MUTED = 'hsl(215 16% 47%)';
const ON_ACCENT = 'hsl(0 0% 100%)';

type Props = {
  warehouse: Warehouse;
  /** Extra line under the address, e.g. distance from a searched place. */
  distanceKm?: number;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
  /** Opens the detail page with every photo. */
  onOpen: () => void;
};

/** Size, volume, rent and deposit — the figures customers compare between warehouses. */
export function WarehouseSpecs({ warehouse }: { warehouse: Warehouse }) {
  const specs = isShelfWarehouse(warehouse) ? shelfSpecs(warehouse) : unitSpecs(warehouse);
  return (
    <View className="gap-1">
      {specs.map(([label, value]) => (
        <View key={label} className="flex-row justify-between gap-3">
          <Text className="font-body text-body-sm text-muted">{label}</Text>
          <Text className="flex-1 text-right font-ui text-body-sm text-foreground">{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A shelf warehouse rents shelf by shelf, so its rows describe the shelves, not the building. */
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

/** One warehouse as an outlined card that can be toggled into the booking selection. */
export function WarehouseCard({
  warehouse,
  distanceKm,
  isSelected,
  isDisabled,
  onToggle,
  onOpen,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Mở chi tiết kho"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      onPress={onOpen}
    >
      <View
        className={`gap-2.5 rounded-xl border p-3 ${
          isSelected ? 'border-accent bg-accent/5' : 'border-border bg-surface'
        }`}
      >
        <WarehouseCover images={warehouse.images ?? []} name={warehouse.name} onPress={onOpen} />
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="font-strong text-foreground text-title-sm">{warehouse.name}</Text>
            <Text className="font-body text-caption text-muted" numberOfLines={1}>
              Thuộc {warehouse.facility.name}
            </Text>
            <View className="flex-row items-start gap-1.5">
              <MapPin color={MUTED} size={14} weight="fill" />
              <Text className="flex-1 font-body text-body-sm text-muted">
                {warehouse.addressLine}
              </Text>
            </View>
            {distanceKm !== undefined ? (
              <Text className="self-start rounded-full bg-accent/10 px-2 py-0.5 font-ui text-caption text-accent">
                Cách {formatNumber(Math.round(distanceKm * 10) / 10)} km
              </Text>
            ) : null}
          </View>
          <View className="items-end">
            <Text className="font-numeric-strong text-accent text-num-lg">
              {isShelfWarehouse(warehouse) ? 'Từ ' : ''}
              {displayMonthlyPrice(warehouse) === null
                ? 'Liên hệ'
                : formatMoney(displayMonthlyPrice(warehouse) ?? 0)}
            </Text>
            <Text className="font-body text-caption text-muted">/tháng</Text>
          </View>
        </View>

        {isShelfWarehouse(warehouse) ? (
          <Text className="font-ui text-caption text-accent">Thuê theo kệ</Text>
        ) : null}
        <WarehouseSpecs warehouse={warehouse} />
        {warehouse.notes ? (
          <Text className="font-body text-body-sm text-subtle">{warehouse.notes}</Text>
        ) : null}

        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-numeric text-caption text-muted">{warehouse.code}</Text>
          <View className="flex-row items-center gap-2">
            {isShelfWarehouse(warehouse) ? (
              // Shelves are chosen on the floor plan, so the card's action opens it.
              <ActionPill
                label="Chọn kệ"
                icon={<Rows color={ON_ACCENT} size={14} weight="bold" />}
                onPress={onOpen}
              />
            ) : (
              <>
                <Text className="font-ui text-caption text-accent">Xem chi tiết</Text>
                <SelectPill isDisabled={isDisabled} isSelected={isSelected} onPress={onToggle} />
              </>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** The card's single call to action, shared by unit and shelf warehouses so both read the same. */
function ActionPill({
  label,
  icon,
  onPress,
  isSelected = false,
  isDisabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  isSelected?: boolean;
  isDisabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => ({ opacity: isDisabled ? 0.4 : pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View
        className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
          isSelected ? 'bg-accent' : 'bg-foreground'
        }`}
      >
        {icon}
        <Text className="font-ui text-caption text-surface">{label}</Text>
      </View>
    </Pressable>
  );
}

function SelectPill({
  isSelected,
  isDisabled,
  onPress,
}: {
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
}) {
  return (
    <ActionPill
      label={isSelected ? 'Đã chọn' : 'Chọn kho'}
      icon={
        isSelected ? (
          <CheckCircle color={ON_ACCENT} size={14} weight="fill" />
        ) : (
          <Plus color={ON_ACCENT} size={14} weight="bold" />
        )
      }
      isSelected={isSelected}
      isDisabled={isDisabled}
      onPress={onPress}
    />
  );
}
