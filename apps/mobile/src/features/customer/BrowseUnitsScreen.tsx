import { Button, Card, Chip } from 'heroui-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { facilityOffers, formatDistance, formatMoney } from '../../data/customer-mocks';
import type { BrowseMode, FacilityOffer, HeldBooking, UnitOffer } from '../../types/customer';

type Props = {
  heldBooking: HeldBooking | null;
  contentBottomPadding: number;
  onHold: (units: UnitOffer[]) => void;
};

export function BrowseUnitsScreen({ heldBooking, contentBottomPadding, onHold }: Props) {
  const [requestedQuantity, setRequestedQuantity] = useState(2);
  const [mode, setMode] = useState<BrowseMode>('recommended');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [waitlistedFacilityId, setWaitlistedFacilityId] = useState<string | null>(null);

  const facilities = Array.isArray(facilityOffers) ? facilityOffers : [];
  const allUnits = facilities.flatMap((facility) => facility.units);
  const selectedUnits = allUnits.filter((unit) => selectedIds.includes(unit.id));
  const selectedFacilities = new Set(selectedUnits.map((unit) => unit.facilityId)).size;

  const changeQuantity = (nextQuantity: number) => {
    const quantity = Math.min(4, Math.max(1, nextQuantity));
    setRequestedQuantity(quantity);
    setSelectedIds((current) => current.slice(0, quantity));
  };

  const toggleUnit = (unit: UnitOffer) => {
    setSelectedIds((current) => {
      if (current.includes(unit.id)) return current.filter((id) => id !== unit.id);
      if (current.length >= requestedQuantity) return current;
      return [...current, unit.id];
    });
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Tìm kho phù hợp</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          Đặt nhiều kho trong một lượt, ưu tiên đủ kho tại cùng cơ sở.
        </Text>
      </View>

      <Card className="mx-4 border border-border bg-surface">
        <Card.Body className="gap-4">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FilterValue label="Khu vực" value="TP. Thủ Đức" />
            </View>
            <View className="w-px bg-separator" />
            <View className="w-20">
              <FilterValue label="Bán kính" value="5 km" />
            </View>
          </View>
          <View className="h-px bg-separator" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FilterValue label="Bắt đầu" value="28/09/2026" />
            </View>
            <View className="w-px bg-separator" />
            <View className="flex-1">
              <FilterValue label="Thời hạn" value="3 tháng" />
            </View>
          </View>
          <View className="h-px bg-separator" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FilterValue label="Kích thước" value="3–5 m²" />
            </View>
            <View className="w-px bg-separator" />
            <View className="flex-1">
              <FilterValue label="Ngân sách mỗi kho" value="≤ 3 triệu/tháng" />
            </View>
          </View>
          <View className="h-px bg-separator" />
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-medium text-muted">Số kho cần thuê</Text>
              <Text className="mt-1 text-sm font-semibold text-foreground">
                Ưu tiên các kho gần nhau
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Button
                accessibilityLabel="Giảm số lượng kho"
                isDisabled={requestedQuantity === 1}
                isIconOnly
                size="sm"
                variant="secondary"
                onPress={() => changeQuantity(requestedQuantity - 1)}
              >
                <Button.Label>−</Button.Label>
              </Button>
              <Text className="min-w-6 text-center text-base font-bold text-foreground">
                {requestedQuantity}
              </Text>
              <Button
                accessibilityLabel="Tăng số lượng kho"
                isDisabled={requestedQuantity === 4}
                isIconOnly
                size="sm"
                variant="secondary"
                onPress={() => changeQuantity(requestedQuantity + 1)}
              >
                <Button.Label>+</Button.Label>
              </Button>
            </View>
          </View>
          <Button className="w-full" onPress={() => setSelectedIds([])}>
            <Button.Label>Tìm kho trống</Button.Label>
          </Button>
        </Card.Body>
      </Card>

      <View className="mt-6 px-4">
        <Text className="text-sm font-bold text-foreground">Cách chọn kho</Text>
        <View className="mt-2 flex-row gap-2">
          <Button
            className="flex-1"
            size="sm"
            variant={mode === 'recommended' ? 'primary' : 'secondary'}
            onPress={() => setMode('recommended')}
          >
            <Button.Label>Hệ thống đề xuất</Button.Label>
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant={mode === 'manual' ? 'primary' : 'secondary'}
            onPress={() => setMode('manual')}
          >
            <Button.Label>Tự chọn kho</Button.Label>
          </Button>
        </View>
      </View>

      <View className="mb-3 mt-6 flex-row items-center justify-between px-4">
        <View>
          <Text className="font-bold text-foreground">
            {mode === 'recommended' ? 'Nhóm kho phù hợp' : 'Kho đang còn trống'}
          </Text>
          <Text className="mt-1 text-xs text-muted">
            Sắp xếp theo khoảng cách từ vị trí đã chọn
          </Text>
        </View>
        <Chip color="accent" size="sm" variant="soft">
          <Chip.Label>{facilities.length} cơ sở</Chip.Label>
        </Chip>
      </View>

      <View className="gap-4 px-4">
        {mode === 'recommended'
          ? facilities.map((facility) => (
              <RecommendedFacilityCard
                key={facility.id}
                facility={facility}
                heldBooking={heldBooking}
                requestedQuantity={requestedQuantity}
                waitlisted={waitlistedFacilityId === facility.id}
                onHold={onHold}
                onWaitlist={() => setWaitlistedFacilityId(facility.id)}
              />
            ))
          : facilities.map((facility) => (
              <ManualFacilityCard
                key={facility.id}
                facility={facility}
                heldBooking={heldBooking}
                requestedQuantity={requestedQuantity}
                selectedIds={selectedIds}
                onToggle={toggleUnit}
              />
            ))}
      </View>

      {mode === 'manual' ? (
        <Card className="mx-4 mt-4 border border-accent/30 bg-accent/5">
          <Card.Body className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-foreground">
                Đã chọn {selectedUnits.length}/{requestedQuantity} kho
              </Text>
              <Text className="text-sm font-semibold text-accent">
                {formatMoney(sumBy(selectedUnits, 'monthlyPrice'))}/tháng
              </Text>
            </View>
            {selectedFacilities > 1 ? (
              <Text className="text-xs leading-5 text-muted">
                Các kho thuộc {selectedFacilities} cơ sở. Chọn cùng một cơ sở để thuận tiện hơn.
              </Text>
            ) : null}
            <Button
              isDisabled={selectedUnits.length !== requestedQuantity || Boolean(heldBooking)}
              onPress={() => onHold(selectedUnits)}
            >
              <Button.Label>Giữ {requestedQuantity} kho đã chọn</Button.Label>
            </Button>
          </Card.Body>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function FilterValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-11 justify-center">
      <Text className="text-xs font-medium text-muted">{label}</Text>
      <Text className="mt-1 text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

type FacilityCardProps = {
  facility: FacilityOffer;
  heldBooking: HeldBooking | null;
  requestedQuantity: number;
};

function RecommendedFacilityCard({
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
            <Text className="mt-1 text-xs font-semibold text-accent">
              {formatDistance(facility.distanceKm)} từ vị trí của bạn
            </Text>
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
          <MoneySummary label="Tổng thuê/tháng" value={sumBy(proposedUnits, 'monthlyPrice')} />
          <MoneySummary label="Cọc cần thanh toán" value={sumBy(proposedUnits, 'deposit')} />
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

function ManualFacilityCard({
  facility,
  heldBooking,
  requestedQuantity,
  selectedIds,
  onToggle,
}: FacilityCardProps & {
  selectedIds: string[];
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
          <Text className="text-xs font-semibold text-accent">
            {formatDistance(facility.distanceKm)}
          </Text>
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
        <Text className="mt-0.5 text-xs text-muted">{unit.features.join(' · ')}</Text>
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

function sumBy(units: UnitOffer[], key: 'monthlyPrice' | 'deposit') {
  return units.reduce((total, unit) => total + unit[key], 0);
}
