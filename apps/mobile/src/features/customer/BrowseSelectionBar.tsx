import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import type { UnitOffer } from '../../types/customer';
import { sumUnitPrices } from './unit-offer-utils';

type Props = {
  selectedUnits: readonly UnitOffer[];
  requestedQuantity: number;
  hasHolding: boolean;
  onHold: (units: UnitOffer[]) => void;
};

/**
 * Pinned summary of a manual selection.
 *
 * Lives outside the scroll area because it is the running answer to "what have I picked so far" —
 * area, money and progress — and the customer needs it while still scrolling through rooms. The
 * progress count on the button is the part that tells them how far from done they are.
 */
export function BrowseSelectionBar({
  selectedUnits,
  requestedQuantity,
  hasHolding,
  onHold,
}: Props) {
  const facilityNames = new Set(selectedUnits.map((unit) => unit.facility));
  const totalArea = selectedUnits.reduce((sum, unit) => sum + unit.areaM2, 0);
  const isComplete = selectedUnits.length === requestedQuantity;
  const singleFacility = facilityNames.size === 1 ? [...facilityNames][0] : null;

  return (
    <View className="shrink-0 border-border border-t bg-surface px-4 py-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1.5">
            <View className={`size-2 rounded-full ${isComplete ? 'bg-success' : 'bg-warning'}`} />
            <Text className="flex-1 font-strong text-body-sm text-foreground" numberOfLines={1}>
              {singleFacility
                ? `Đã chọn ${selectedUnits.length} kho tại ${singleFacility}`
                : `Đã chọn ${selectedUnits.length} kho tại ${facilityNames.size} cơ sở`}
            </Text>
          </View>
          <View className="flex-row items-baseline gap-1">
            <Text className="font-body text-caption text-muted">
              Tổng {formatNumber(totalArea)} m²
            </Text>
            <Text className="font-numeric text-accent text-num-sm">
              {formatMoney(sumUnitPrices(selectedUnits, 'monthlyPrice'))}
            </Text>
            <Text className="font-body text-caption text-muted">/tháng</Text>
          </View>
        </View>

        <Button isDisabled={!isComplete || hasHolding} onPress={() => onHold([...selectedUnits])}>
          <Button.Label className="font-ui">
            Tiếp tục ({selectedUnits.length}/{requestedQuantity})
          </Button.Label>
        </Button>
      </View>
    </View>
  );
}
