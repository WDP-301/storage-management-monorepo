import { Button, Card, Chip } from 'heroui-native';
import { ScrollView, Text, View } from 'react-native';
import { formatMoney } from '../../data/customer-mocks';
import type { HeldBooking, UnitOffer } from '../../types/customer';

type Props = {
  heldBooking: HeldBooking | null;
  remaining: string;
  contentBottomPadding: number;
  onBrowse: () => void;
};

export function MyBookingsScreen({
  heldBooking,
  remaining,
  contentBottomPadding,
  onBrowse,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Booking của tôi</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          Mỗi booking có thể bao gồm nhiều kho và nhiều khoản tiền riêng.
        </Text>
      </View>

      <View className="gap-4 px-4">
        <Text className="text-sm font-bold text-foreground">Đang giữ</Text>
        {heldBooking ? (
          <HeldBookingCard booking={heldBooking} remaining={remaining} />
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-border px-5 py-10">
            <View className="size-12 items-center justify-center rounded-2xl bg-surface-secondary">
              <Text className="text-xl font-black text-muted">0</Text>
            </View>
            <Text className="mt-4 font-semibold text-foreground">Chưa có booking đang giữ</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-muted">
              Chọn một nhóm kho phù hợp và giữ toàn bộ trong 15 phút.
            </Text>
            <Button className="mt-5" variant="secondary" onPress={onBrowse}>
              <Button.Label>Tìm kho trống</Button.Label>
            </Button>
          </View>
        )}

        <Text className="mt-3 text-sm font-bold text-foreground">Sắp tới</Text>
        <Card className="border border-border bg-surface">
          <Card.Body className="gap-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bold text-foreground">BK-260923-018 · 2 kho</Text>
                <Text className="mt-1 text-sm text-muted">Thủ Đức 01</Text>
              </View>
              <Chip color="success" size="sm" variant="soft">
                <Chip.Label>Đã xác nhận</Chip.Label>
              </Chip>
            </View>
            <View className="gap-2 rounded-xl bg-surface-secondary p-3">
              <Text className="text-sm font-semibold text-foreground">A-108 · 3 m²</Text>
              <Text className="text-sm font-semibold text-foreground">A-109 · 3 m²</Text>
            </View>
            <View className="flex-row justify-between gap-3">
              <View>
                <Text className="text-xs text-muted">Nhận kho</Text>
                <Text className="mt-1 text-sm font-semibold text-foreground">
                  28/09/2026 · 08:30
                </Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Thời hạn</Text>
                <Text className="mt-1 text-sm font-semibold text-foreground">3 tháng</Text>
              </View>
            </View>
            <Button variant="secondary" onPress={() => undefined}>
              <Button.Label>Xem QR nhận kho</Button.Label>
            </Button>
          </Card.Body>
        </Card>
      </View>
    </ScrollView>
  );
}

function HeldBookingCard({ booking, remaining }: { booking: HeldBooking; remaining: string }) {
  const totalRent = sumBy(booking.units, 'monthlyPrice');
  const totalDeposit = sumBy(booking.units, 'deposit');
  const facilityCount = new Set(booking.units.map((unit) => unit.facilityId)).size;

  return (
    <Card className="border border-accent/30 bg-accent/5">
      <Card.Body className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">
              {booking.id} · {booking.units.length} kho
            </Text>
            <Text className="mt-1 text-sm text-muted">
              {facilityCount === 1 ? booking.units[0]?.facility : `${facilityCount} cơ sở`}
            </Text>
          </View>
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label>Giữ tạm</Chip.Label>
          </Chip>
        </View>

        <View className="rounded-xl bg-accent/10 px-3 py-3">
          <Text className="text-xs text-muted">Thanh toán cọc trước khi hết thời gian</Text>
          <Text className="mt-1 font-mono text-xl font-bold text-accent">{remaining}</Text>
          <Text className="mt-1 text-xs leading-5 text-muted">
            Chỉ xác nhận khi tất cả {booking.units.length} kho còn hợp lệ.
          </Text>
        </View>

        <View className="gap-2">
          {booking.units.map((unit) => (
            <BookingUnitRow key={unit.id} unit={unit} />
          ))}
        </View>

        <View className="flex-row gap-3 rounded-xl bg-surface p-3">
          <View className="flex-1">
            <Text className="text-xs text-muted">Tổng thuê/tháng</Text>
            <Text className="mt-1 font-bold text-foreground">{formatMoney(totalRent)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted">Tổng cọc</Text>
            <Text className="mt-1 font-bold text-foreground">{formatMoney(totalDeposit)}</Text>
          </View>
        </View>

        <View className="flex-row justify-between gap-3">
          <View>
            <Text className="text-xs text-muted">Ngày nhận</Text>
            <Text className="mt-1 text-sm font-semibold text-foreground">{booking.startDate}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted">Thời hạn</Text>
            <Text className="mt-1 text-sm font-semibold text-foreground">
              {booking.durationMonths} tháng
            </Text>
          </View>
        </View>

        <Button onPress={() => undefined}>
          <Button.Label>Thanh toán cọc · {formatMoney(totalDeposit)}</Button.Label>
        </Button>
      </Card.Body>
    </Card>
  );
}

function BookingUnitRow({ unit }: { unit: UnitOffer }) {
  return (
    <View className="rounded-xl border border-border bg-surface p-3">
      <View className="flex-row justify-between gap-3">
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
      <Text className="mt-2 text-xs text-muted">Cọc: {formatMoney(unit.deposit)}</Text>
    </View>
  );
}

function sumBy(units: UnitOffer[], key: 'monthlyPrice' | 'deposit') {
  return units.reduce((total, unit) => total + unit[key], 0);
}
