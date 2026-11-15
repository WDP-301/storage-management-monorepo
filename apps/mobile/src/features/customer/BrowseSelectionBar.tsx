import { View } from 'react-native';
import { useBookingSettings } from '../../../lib/client-settings';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { Button, PayBar } from '../../components/ui';
import type { Warehouse } from '../../types/storage-api';

type Props = {
  selected: readonly Warehouse[];
  hasHolding: boolean;
  onContinue: () => void;
  onClear: () => void;
};

/** Pinned Medipay PayBar summary of the warehouses/shelves picked so far. */
export function BrowseSelectionBar({ selected, hasHolding, onContinue, onClear }: Props) {
  const { maxUnitsPerBooking } = useBookingSettings();
  const totalArea = selected.reduce((sum, warehouse) => sum + warehouse.areaM2, 0);
  const totalRent = selected.reduce((sum, warehouse) => sum + warehouse.monthlyPrice, 0);
  const unitLabel = selected.every((warehouse) => warehouse.kind === 'SHELF')
    ? 'kệ'
    : selected.every((warehouse) => warehouse.kind === 'SELF_STORAGE')
      ? 'kho'
      : 'vị trí';

  return (
    <PayBar
      amount={`${formatMoney(totalRent)}/tháng`}
      caption={`Tổng ${formatNumber(totalArea)} m²`}
      insetBottom={false}
      label={`Đã chọn ${selected.length}/${maxUnitsPerBooking} ${unitLabel}`}
    >
      <View className="flex-row gap-3">
        <Button
          className="flex-1"
          fullWidth={false}
          label="Bỏ chọn"
          onPress={onClear}
          variant="secondary"
        />
        <Button
          className="flex-[2]"
          disabled={hasHolding}
          fullWidth={false}
          label="Tiếp tục"
          onPress={onContinue}
        />
      </View>
    </PayBar>
  );
}
