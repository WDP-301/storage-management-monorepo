import { Button, Card } from 'heroui-native';
import { Text, View } from 'react-native';
import { formatMoney } from '../../../lib/format-vi';
import type { UnitOffer } from '../../types/customer';
import { sumUnitPrices } from './unit-offer-utils';

type Props = {
  selectedUnits: readonly UnitOffer[];
  requestedQuantity: number;
  hasHolding: boolean;
  onHold: (units: UnitOffer[]) => void;
};

/**
 * Pinned summary of a manual selection. Lives outside the scroll area so the running total and the
 * confirm button stay reachable while the customer keeps browsing.
 */
export function BrowseSelectionBar({
  selectedUnits,
  requestedQuantity,
  hasHolding,
  onHold,
}: Props) {
  const selectedFacilityCount = new Set(selectedUnits.map((unit) => unit.facilityId)).size;

  return (
    <View className="shrink-0 border-border border-t bg-background px-4 py-3">
      <Card className="border border-accent/30 bg-accent/5">
        <Card.Body className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-foreground">
              Đã chọn {selectedUnits.length}/{requestedQuantity} kho
            </Text>
            <Text className="font-semibold text-accent text-sm">
              {formatMoney(sumUnitPrices(selectedUnits, 'monthlyPrice'))}/tháng
            </Text>
          </View>
          {selectedFacilityCount > 1 ? (
            <Text className="text-muted text-xs leading-5">
              Các kho thuộc {selectedFacilityCount} cơ sở. Chọn cùng một cơ sở để thuận tiện hơn.
            </Text>
          ) : null}

          <Button
            isDisabled={selectedUnits.length !== requestedQuantity || hasHolding}
            onPress={() => onHold([...selectedUnits])}
          >
            <Button.Label>Chọn {requestedQuantity} kho đã chọn</Button.Label>
          </Button>
        </Card.Body>
      </Card>
    </View>
  );
}
