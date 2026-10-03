import { Button, Card } from 'heroui-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import type { RentalSchedule } from '../../../lib/hold';
import {
  buildDateOptions,
  DEFAULT_DURATION_MONTHS,
  DURATION_OPTIONS,
  rentalEndIso,
  todayIso,
} from '../../../lib/rental-schedule';
import type { UnitOffer } from '../../types/customer';
import { ChipButton, FilterRow } from './FilterChips';
import { RentalDateStrip } from './RentalDateStrip';
import { sumUnitPrices } from './unit-offer-utils';

type Props = {
  units: UnitOffer[];
  isCreating: boolean;
  error: string | null;
  onConfirm: (schedule: RentalSchedule) => void;
};

/**
 * Chooses the rental terms before the API creates a booking and starts its 15-minute hold.
 */
export function ScheduleRentalScreen({ units, isCreating, error, onConfirm }: Props) {
  const [startDate, setStartDate] = useState(todayIso);
  const [durationMonths, setDurationMonths] = useState(DEFAULT_DURATION_MONTHS);

  // Rebuilt every render rather than memoised: 30 small objects cost nothing, and a frozen list
  // would still start at yesterday if the screen stayed mounted across midnight — which would
  // mislabel "Hôm nay" and offer a past date, the very thing starting the strip at today prevents.
  const dateOptions = buildDateOptions();
  const endDate = rentalEndIso(startDate, durationMonths);

  const monthlyRent = sumUnitPrices(units, 'monthlyPrice');
  const deposit = sumUnitPrices(units, 'deposit');
  const totalRent = monthlyRent * durationMonths;

  const facilityName = units[0]?.facility ?? '';
  const facilityCount = new Set(units.map((unit) => unit.facilityId)).size;

  return (
    <ScrollView contentContainerClassName="pb-8 pt-5" showsVerticalScrollIndicator={false}>
      <View className="px-4">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Đặt lịch thuê kho</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          {units.length} kho tại {facilityCount === 1 ? facilityName : `${facilityCount} cơ sở`}
        </Text>
      </View>

      <Card className="mx-4 mt-4 border border-accent/30 bg-accent/5">
        <Card.Body>
          <Text className="text-xs leading-5 text-muted">
            Chọn lịch rồi xác nhận để giữ kho trong 15 phút. Giá và tình trạng kho sẽ được kiểm tra
            lại khi gửi.
          </Text>
        </Card.Body>
      </Card>

      <View className="mt-6">
        <Text className="px-4 text-sm font-bold text-foreground">Ngày nhận kho</Text>
        <View className="mt-3">
          <RentalDateStrip options={dateOptions} selectedIso={startDate} onSelect={setStartDate} />
        </View>
      </View>

      <View className="mt-6 px-4">
        <FilterRow label="Thời hạn thuê">
          {DURATION_OPTIONS.map((months) => (
            <ChipButton
              key={months}
              isSelected={durationMonths === months}
              label={`${months} tháng`}
              onPress={() => setDurationMonths(months)}
            />
          ))}
        </FilterRow>
        <Text className="mt-3 text-sm text-muted">
          Thuê từ <Text className="font-semibold text-foreground">{formatIsoDate(startDate)}</Text>{' '}
          đến <Text className="font-semibold text-foreground">{formatIsoDate(endDate)}</Text>
        </Text>
      </View>

      <View className="mt-6 px-4">
        <Text className="text-sm font-bold text-foreground">Kho đã chọn</Text>
        <View className="mt-3 gap-2">
          {units.map((unit) => (
            <View
              key={unit.id}
              className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <View className="flex-1">
                <Text className="font-bold text-foreground">
                  {unit.code} · {unit.size}
                </Text>
                <Text className="mt-1 text-xs text-muted">
                  {unit.facility} · {unit.zone}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {formatMoney(unit.monthlyPrice)}/tháng
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Card className="mx-4 mt-6 border border-border bg-surface">
        <Card.Body className="gap-3">
          <Text className="font-bold text-foreground">Chi phí</Text>
          <CostRow label={`Tiền thuê ${durationMonths} tháng`} value={totalRent} />
          <CostRow label="Tiền cọc" value={deposit} />
          <View className="h-px bg-separator" />
          {/* Only the deposit is due now; rent is invoiced over the rental period. */}
          <View className="flex-row items-end justify-between gap-3">
            <View className="flex-1">
              <Text className="font-semibold text-foreground">Trả hôm nay</Text>
              <Text className="mt-1 text-xs text-muted">Tiền cọc, hoàn khi trả kho</Text>
            </View>
            <Text className="text-lg font-bold text-accent">{formatMoney(deposit)}</Text>
          </View>
        </Card.Body>
      </Card>

      <View className="mt-6 px-4">
        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        <Button isDisabled={isCreating} onPress={() => onConfirm({ startDate, durationMonths })}>
          <Button.Label>{isCreating ? 'Đang giữ kho...' : 'Xác nhận và giữ kho'}</Button.Label>
        </Button>
      </View>
    </ScrollView>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{formatMoney(value)}</Text>
    </View>
  );
}
