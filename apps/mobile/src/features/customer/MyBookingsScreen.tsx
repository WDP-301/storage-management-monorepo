import { Button, Card, Chip } from 'heroui-native';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { holdState } from '../../../lib/booking-hold-state';
import { formatArea, formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { rentalEndIso } from '../../../lib/rental-schedule';
import type { ApiBooking } from '../../types/booking-api';

type Props = {
  bookings: ApiBooking[];
  isLoading: boolean;
  error: string | null;
  contentBottomPadding: number;
  onBrowse: () => void;
  onRefresh: () => void;
};

export function MyBookingsScreen({
  bookings,
  isLoading,
  error,
  contentBottomPadding,
  onBrowse,
  onRefresh,
}: Props) {
  const active = bookings.filter(isActiveHold);
  const others = bookings.filter((booking) => !isActiveHold(booking));

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      refreshControl={
        <RefreshControl refreshing={isLoading && bookings.length > 0} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pb-4 pt-5">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Booking của tôi</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          Theo dõi các kho đang giữ và những booking đã tạo.
        </Text>
      </View>

      <View className="gap-4 px-4">
        {error ? (
          <View className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            <Text className="text-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRefresh}>
              <Button.Label>Thử lại</Button.Label>
            </Button>
          </View>
        ) : null}
        {isLoading && bookings.length === 0 ? <ActivityIndicator /> : null}

        <Text className="text-sm font-bold text-foreground">Đang giữ</Text>
        {active.length > 0 ? (
          active.map((booking) => <BookingCard key={booking.id} booking={booking} isHolding />)
        ) : isLoading && bookings.length === 0 ? null : (
          <View className="items-center rounded-2xl border border-dashed border-border px-5 py-10">
            <Text className="font-semibold text-foreground">Chưa có booking đang giữ</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-muted">
              Chọn kho và lịch thuê để giữ chỗ trong 15 phút.
            </Text>
            <Button className="mt-5" variant="secondary" onPress={onBrowse}>
              <Button.Label>Tìm kho trống</Button.Label>
            </Button>
          </View>
        )}

        <Text className="mt-3 text-sm font-bold text-foreground">Các booking khác</Text>
        {others.length > 0 ? (
          others.map((booking) => (
            <BookingCard key={booking.id} booking={booking} isHolding={false} />
          ))
        ) : isLoading && bookings.length === 0 ? null : (
          <Text className="text-sm text-muted">Chưa có booking nào khác.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function BookingCard({ booking, isHolding }: { booking: ApiBooking; isHolding: boolean }) {
  const first = booking.items[0];
  const firstDate = first?.requestedStartAt.slice(0, 10);
  const sameSchedule = booking.items.every(
    (item) =>
      item.requestedStartAt.slice(0, 10) === firstDate && item.rentalMonths === first?.rentalMonths,
  );
  const state = holdState(booking, Date.now());
  const status = state === 'expired' ? 'Hết hạn giữ' : statusLabel(booking.status);

  return (
    <Card
      className={
        isHolding ? 'border border-accent/30 bg-accent/5' : 'border border-border bg-surface'
      }
    >
      <Card.Body className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{booking.bookingNo}</Text>
            <Text className="mt-1 text-sm text-muted">{booking.items.length} kho</Text>
          </View>
          <Chip
            color={isHolding ? 'accent' : booking.status === 'CONFIRMED' ? 'success' : 'default'}
            size="sm"
            variant="soft"
          >
            <Chip.Label>{status}</Chip.Label>
          </Chip>
        </View>

        {state === 'unknown' ? (
          <Text className="text-xs leading-5 text-muted">
            Chưa có thông tin thời hạn giữ của booking này. Kéo xuống để cập nhật.
          </Text>
        ) : null}

        {isHolding && booking.expiresAt ? (
          <View className="rounded-xl bg-accent/10 px-3 py-3">
            <Text className="text-xs text-muted">Thời gian giữ còn lại</Text>
            <Text className="mt-1 font-mono text-xl font-bold text-accent">
              {formatRemaining(new Date(booking.expiresAt).getTime() - Date.now())}
            </Text>
          </View>
        ) : null}

        <View className="gap-2">
          {booking.items.map((item) => (
            <View key={item.id} className="rounded-xl border border-border bg-surface p-3">
              <Text className="font-bold text-foreground">
                {item.storageUnit?.code ?? item.storageUnitId}
                {item.storageUnit ? ` · ${formatArea(Number(item.storageUnit.areaM2))}` : ''}
              </Text>
              <Text className="mt-1 text-xs text-muted">
                {formatMoney(Number(item.monthlyPriceSnapshot))}/tháng · Cọc{' '}
                {formatMoney(Number(item.depositSnapshot))}
              </Text>
              {!sameSchedule ? (
                <Text className="mt-1 text-xs text-muted">
                  Nhận {formatIsoDate(item.requestedStartAt.slice(0, 10))} · {item.rentalMonths}{' '}
                  tháng
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {sameSchedule && firstDate && first ? (
          <View className="flex-row justify-between gap-3">
            <View>
              <Text className="text-xs text-muted">Ngày nhận</Text>
              <Text className="mt-1 text-sm font-semibold text-foreground">
                {formatIsoDate(firstDate)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-muted">Thuê đến</Text>
              <Text className="mt-1 text-sm font-semibold text-foreground">
                {formatIsoDate(rentalEndIso(firstDate, first.rentalMonths))}
              </Text>
            </View>
          </View>
        ) : null}

        <View className="flex-row justify-between gap-3 border-t border-border pt-3">
          <Text className="text-sm text-muted">Tổng tiền thuê</Text>
          <Text className="text-sm font-bold text-foreground">
            {formatMoney(Number(booking.subtotal))}
          </Text>
        </View>
        <View className="flex-row justify-between gap-3">
          <Text className="text-sm text-muted">Tiền cọc</Text>
          <Text className="text-sm font-bold text-foreground">
            {formatMoney(Number(booking.depositTotal))}
          </Text>
        </View>
      </Card.Body>
    </Card>
  );
}

function isActiveHold(booking: ApiBooking) {
  return holdState(booking, Date.now()) === 'active';
}

function statusLabel(status: ApiBooking['status']) {
  switch (status) {
    case 'HOLDING':
      return 'Đang giữ';
    case 'EXPIRED':
      return 'Hết hạn giữ';
    case 'PENDING_DEPOSIT':
      return 'Chờ thanh toán cọc';
    case 'CONFIRMED':
      return 'Đã xác nhận';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return 'Nháp';
  }
}

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
