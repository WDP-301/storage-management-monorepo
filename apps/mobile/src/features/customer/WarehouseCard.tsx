import { CheckCircle, MapPin, Plus } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';
import { formatDimensions, formatMoney, formatNumber } from '../../../lib/format-vi';
import { warehouseDeposit } from '../../../lib/warehouse-query';
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
};

/** Size, volume, rent and deposit — the figures customers compare between warehouses. */
export function WarehouseSpecs({ warehouse }: { warehouse: Warehouse }) {
  const specs = [
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

/** One warehouse as an outlined card that can be toggled into the booking selection. */
export function WarehouseCard({ warehouse, distanceKm, isSelected, isDisabled, onToggle }: Props) {
  return (
    <View
      className={`gap-2.5 rounded-xl border p-3 ${
        isSelected ? 'border-accent bg-accent/5' : 'border-border bg-surface'
      }`}
    >
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
              {distanceKm !== undefined ? ` · cách ${formatNumber(distanceKm)} km` : ''}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="font-numeric-strong text-accent text-num-lg">
            {formatMoney(warehouse.monthlyPrice)}
          </Text>
          <Text className="font-body text-caption text-muted">/tháng</Text>
        </View>
      </View>

      <WarehouseSpecs warehouse={warehouse} />
      {warehouse.notes ? (
        <Text className="font-body text-body-sm text-subtle">{warehouse.notes}</Text>
      ) : null}

      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-numeric text-caption text-muted">{warehouse.code}</Text>
        <SelectPill isDisabled={isDisabled} isSelected={isSelected} onPress={onToggle} />
      </View>
    </View>
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
        {isSelected ? (
          <CheckCircle color={ON_ACCENT} size={14} weight="fill" />
        ) : (
          <Plus color={ON_ACCENT} size={14} weight="bold" />
        )}
        <Text className="font-ui text-caption text-surface">
          {isSelected ? 'Đã chọn' : 'Chọn kho'}
        </Text>
      </View>
    </Pressable>
  );
}
