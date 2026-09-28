import { Button, Card, Chip } from 'heroui-native';
import { Text, View } from 'react-native';
import { formatMoney } from '../../../lib/format-vi';
import type { FacilityOffer, HeldBooking, UnitOffer } from '../../types/customer';
import { sumUnitPrices } from './unit-offer-utils';

type FacilityCardProps = {
  facility: FacilityOffer;
  heldBooking: HeldBooking | null;
  requestedQuantity: number;
};

/** Proposes the cheapest N units of one facility as a single group to hold. */
export function RecommendedFacilityCard({
  facility,
  heldBooking,
  requestedQuantity,
  waitlisted,
  onHold,
  onWaitlist,
}: FacilityCardProps & {
  waitlisted: boolean;
  onHold: (units: UnitOffer[]) => void;
  onWaitlist: () => void;
}) {
  const proposedUnits = facility.units.slice(0, requestedQuantity);
  const isComplete = proposedUnits.length === requestedQuantity;

  return (
    <Card className="border border-border bg-surface">
      <Card.Body className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{facility.name}</Text>
            <Text className="mt-1 text-xs leading-5 text-muted">{facility.address}</Text>
          </View>
          <Chip color={isComplete ? 'success' : 'warning'} size="sm" variant="soft">
            <Chip.Label>
              {isComplete
                ? `Đủ ${requestedQuantity}/${requestedQuantity} kho`
                : `Còn ${proposedUnits.length} kho`}
            </Chip.Label>
          </Chip>
        </View>

        <View className="gap-2">
          {proposedUnits.map((unit) => (
            <UnitSummary key={unit.id} unit={unit} />
          ))}
        </View>

        <View className="h-px bg-separator" />
        <View className="flex-row justify-between gap-4">
          <MoneySummary
            label="Tổng thuê/tháng"
            value={sumUnitPrices(proposedUnits, 'monthlyPrice')}
          />
          <MoneySummary
            label="Cọc cần thanh toán"
            value={sumUnitPrices(proposedUnits, 'deposit')}
          />
        </View>

        {isComplete ? (
          <Button isDisabled={Boolean(heldBooking)} onPress={() => onHold(proposedUnits)}>
            <Button.Label>Giữ nhóm {requestedQuantity} kho · 15 phút</Button.Label>
          </Button>
        ) : (
          <View className="gap-2">
            <Text className="text-xs leading-5 text-muted">
              Cơ sở này chưa đủ số lượng. Bạn có thể giảm số kho hoặc chờ khi đủ kho phù hợp.
            </Text>
            <Button variant="secondary" onPress={onWaitlist}>
              <Button.Label>
                {waitlisted ? 'Đã đăng ký danh sách chờ' : 'Tham gia danh sách chờ'}
              </Button.Label>
            </Button>
          </View>
        )}
      </Card.Body>
    </Card>
  );
}

/** Lists every available unit of a facility so the customer picks them one by one. */
export function ManualFacilityCard({
  facility,
  heldBooking,
  requestedQuantity,
  selectedIds,
  onToggle,
}: FacilityCardProps & {
  selectedIds: readonly string[];
  onToggle: (unit: UnitOffer) => void;
}) {
  return (
    <Card className="border border-border bg-surface">
      <Card.Body className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-bold text-foreground">{facility.name}</Text>
            <Text className="mt-1 text-xs text-muted">{facility.address}</Text>
          </View>
        </View>
        {facility.units.map((unit) => {
          const isSelected = selectedIds.includes(unit.id);
          const selectionFull = selectedIds.length >= requestedQuantity && !isSelected;

          return (
            <View
              key={unit.id}
              className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-3"
            >
              <View className="flex-1">
                <Text className="font-bold text-foreground">
                  {unit.code} · {unit.size}
                </Text>
                <Text className="mt-1 text-xs text-muted">
                  {unit.zone} · {unit.dimensions}
                </Text>
                <Text className="mt-1 text-sm font-semibold text-foreground">
                  {formatMoney(unit.monthlyPrice)}/tháng
                </Text>
              </View>
              <Button
                isDisabled={selectionFull || Boolean(heldBooking)}
                size="sm"
                variant={isSelected ? 'primary' : 'secondary'}
                onPress={() => onToggle(unit)}
              >
                <Button.Label>{isSelected ? 'Đã chọn' : 'Chọn'}</Button.Label>
              </Button>
            </View>
          );
        })}
      </Card.Body>
    </Card>
  );
}

function UnitSummary({ unit }: { unit: UnitOffer }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-3">
      <View className="size-11 items-center justify-center rounded-xl border border-border bg-surface">
        <Text className="text-xs font-bold text-foreground">{unit.size}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-bold text-foreground">
          {unit.code} · {unit.zone}
        </Text>
        <Text className="mt-0.5 text-xs text-muted">
          {unit.notes ? `${unit.unitTypeName} · ${unit.notes}` : unit.unitTypeName}
        </Text>
      </View>
      <Text className="text-sm font-semibold text-foreground">
        {formatMoney(unit.monthlyPrice)}
      </Text>
    </View>
  );
}

function MoneySummary({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="mt-1 font-bold text-foreground">{formatMoney(value)}</Text>
    </View>
  );
}
