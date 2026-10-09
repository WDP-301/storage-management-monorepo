import { Button } from 'heroui-native';
import { CheckCircle, Door, MapPin, Plus, Warning } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import type { FacilityOffer, UnitOffer } from '../../types/customer';
import { sumUnitPrices } from './unit-offer-utils';

/** Mirror the colour tokens in global.css; SVG icons cannot read a Tailwind class. */
const ACCENT = 'hsl(203 100% 30%)';
const MUTED = 'hsl(215 16% 47%)';
const SUCCESS = 'hsl(160 84% 31%)';
const WARNING = 'hsl(32 95% 44%)';
const ON_ACCENT = 'hsl(0 0% 100%)';

type FacilityCardProps = {
  facility: FacilityOffer;
  hasHolding: boolean;
  requestedQuantity: number;
};

/**
 * One facility, laid out as a building header over a matrix of its rooms.
 *
 * The header answers "is this place worth opening" — name, address, how many rooms are free and
 * whether that covers the request — before any individual room is read. The rooms below are then a
 * comparison grid, each an outlined card so it reads as something that can be picked rather than a
 * row in a spec table.
 */
export function RecommendedFacilityCard({
  facility,
  hasHolding,
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
  const remainingCount = facility.units.length - proposedUnits.length;

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-surface">
      <FacilityHeader
        facility={facility}
        isComplete={isComplete}
        requestedQuantity={requestedQuantity}
      />

      <View className="gap-2 px-3 pt-3">
        <View className="flex-row items-end justify-between gap-3">
          <Text className="font-ui text-caption text-muted uppercase tracking-wide">
            Kho sẵn sàng giao nhận ngay
          </Text>
          <Text className="font-body text-caption text-muted">Đơn vị: VNĐ</Text>
        </View>

        {proposedUnits.map((unit) => (
          <UnitCard key={unit.id} isSelected unit={unit} />
        ))}

        {remainingCount > 0 ? (
          <Text className="font-body pt-1 text-body-sm text-muted">
            Cơ sở còn {remainingCount} kho trống khác. Đổi sang Tự chọn kho để xem hết.
          </Text>
        ) : null}
      </View>

      <View className="mt-3 gap-3 border-separator border-t px-3 py-3">
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
          <Button isDisabled={hasHolding} onPress={() => onHold(proposedUnits)}>
            <Button.Label className="font-ui">Chọn nhóm {requestedQuantity} kho</Button.Label>
          </Button>
        ) : (
          <View className="gap-2">
            <Text className="font-body text-body-sm text-muted">
              Cơ sở này chưa đủ số lượng. Bạn có thể giảm số kho hoặc chờ khi đủ kho phù hợp.
            </Text>
            <Button variant="secondary" onPress={onWaitlist}>
              <Button.Label className="font-ui">
                {waitlisted ? 'Đã đăng ký danh sách chờ' : 'Tham gia danh sách chờ'}
              </Button.Label>
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}

/** Lists every available unit of a facility so the customer picks them one by one. */
export function ManualFacilityCard({
  facility,
  hasHolding,
  requestedQuantity,
  selectedIds,
  onToggle,
}: FacilityCardProps & {
  selectedIds: readonly string[];
  onToggle: (unit: UnitOffer) => void;
}) {
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-surface">
      <FacilityHeader
        facility={facility}
        isComplete={facility.units.length >= requestedQuantity}
        requestedQuantity={requestedQuantity}
      />

      <View className="gap-2 px-3 py-3">
        <View className="flex-row items-end justify-between gap-3">
          <Text className="font-ui text-caption text-muted uppercase tracking-wide">
            {facility.units.length} kho đang trống
          </Text>
          <Text className="font-body text-caption text-muted">Đơn vị: VNĐ</Text>
        </View>

        {facility.units.map((unit) => {
          const isSelected = selectedIds.includes(unit.id);
          const selectionFull = selectedIds.length >= requestedQuantity && !isSelected;

          return (
            <UnitCard
              key={unit.id}
              isDisabled={selectionFull || hasHolding}
              isSelected={isSelected}
              unit={unit}
              onToggle={() => onToggle(unit)}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Building header: who and where, then the capacity answer, on its own tinted ground. */
function FacilityHeader({
  facility,
  isComplete,
  requestedQuantity,
}: {
  facility: FacilityOffer;
  isComplete: boolean;
  requestedQuantity: number;
}) {
  return (
    <View className="gap-2.5 px-3 pt-3">
      <View className="flex-row items-center gap-2">
        {/* A facility only reaches this list when it is active and has stock, so the dot is a
            standing "open" signal rather than a status that varies per card. */}
        <View className="size-2 rounded-full bg-success" />
        <Text className="flex-1 font-strong text-foreground text-title-sm">{facility.name}</Text>
      </View>

      <View className="flex-row items-center gap-1.5">
        <MapPin color={MUTED} size={14} weight="fill" />
        <Text className="flex-1 font-body text-body-sm text-muted">{facility.address}</Text>
      </View>

      <View
        className={`flex-row items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${
          isComplete ? 'bg-success-bg' : 'bg-warning-bg'
        }`}
      >
        <View className="flex-row items-center gap-1.5">
          {isComplete ? (
            <CheckCircle color={SUCCESS} size={15} weight="fill" />
          ) : (
            <Warning color={WARNING} size={15} weight="fill" />
          )}
          <Text
            className={`font-strong text-body-sm ${isComplete ? 'text-success' : 'text-warning'}`}
          >
            Còn {facility.units.length} kho trống
          </Text>
        </View>
        <Text className={`font-ui text-caption ${isComplete ? 'text-success' : 'text-warning'}`}>
          {isComplete ? `Đủ cho nhu cầu ${requestedQuantity} kho` : `Chưa đủ ${requestedQuantity}`}
        </Text>
      </View>
    </View>
  );
}

/**
 * One room, as an outlined card.
 *
 * Code, type badge and area share the top line with the price because those four values are what
 * get compared between rooms; dimensions and the location note drop below, where they inform a
 * choice already narrowed by the numbers above.
 *
 * `onToggle` absent means the row is informational — the recommended mode has already chosen these
 * and the customer commits to the group with the card's own action.
 */
function UnitCard({
  unit,
  isSelected,
  isDisabled = false,
  onToggle,
}: {
  unit: UnitOffer;
  isSelected: boolean;
  isDisabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <View
      className={`gap-2 rounded-lg border p-2.5 ${
        isSelected ? 'border-accent bg-accent/5' : 'border-border bg-surface'
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-1.5">
          <Text className="font-numeric text-foreground text-num-md">{unit.code}</Text>
          <View className="rounded bg-surface-secondary px-1.5 py-0.5">
            <Text className="font-ui text-caption text-subtle">{unit.unitTypeName}</Text>
          </View>
          <Text className="font-numeric text-num-sm text-subtle">
            {formatNumber(unit.areaM2)} m²
          </Text>
        </View>
        <View className="flex-row items-baseline gap-0.5">
          <Text className="font-numeric-strong text-accent text-num-lg">
            {formatMoney(unit.monthlyPrice)}
          </Text>
          <Text className="font-body text-caption text-muted">/tháng</Text>
        </View>
      </View>

      <View className="flex-row items-end justify-between gap-2">
        <View className="flex-1 gap-1">
          <Text className="font-body text-body-sm text-muted">Kích thước: {unit.dimensions}</Text>
          {unit.notes ? (
            <View className="flex-row items-center gap-1.5">
              <Door color={MUTED} size={13} weight="fill" />
              <Text className="flex-1 font-body text-body-sm text-subtle">{unit.notes}</Text>
            </View>
          ) : null}
        </View>

        {onToggle ? (
          <SelectPill isDisabled={isDisabled} isSelected={isSelected} onPress={onToggle} />
        ) : (
          <View className="flex-row items-center gap-1">
            <CheckCircle color={ACCENT} size={15} weight="fill" />
            <Text className="font-ui text-accent text-caption">Đã chọn</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Compact pill action, so picking a room never looks like the screen's primary commitment. */
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

function MoneySummary({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1">
      <Text className="font-body text-caption text-muted">{label}</Text>
      <Text className="mt-1 font-numeric-strong text-foreground text-num-lg">
        {formatMoney(value)}
      </Text>
    </View>
  );
}
