import * as Clipboard from 'expo-clipboard';
import { Button } from 'heroui-native';
import { Copy, Timer } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatRemaining, holdDeadline } from '../../../lib/booking-hold-state';
import { depositStage } from '../../../lib/booking-payment-state';
import { formatIsoDate, formatMoney, formatNumber } from '../../../lib/format-vi';
import { EXPIRING_SOON_MS } from '../../../lib/hold';
import type { ApiBooking } from '../../types/booking-api';
import { useBookingWarehouses } from './use-booking-warehouses';

/** Mirror the colour tokens in global.css; SVG icons cannot read a Tailwind class. */
const WARNING = 'hsl(32 95% 44%)';
const DANGER = 'hsl(0 72% 51%)';
const MUTED = 'hsl(215 16% 47%)';

/**
 * A booking that never became a rental: still awaiting its deposit, or lapsed/cancelled. Paid
 * bookings are not shown with this card — from then on the customer sees the contract instead.
 */
export function BookingHoldCard({
  booking,
  now,
  onPay,
}: {
  booking: ApiBooking;
  now: number;
  onPay: () => void;
}) {
  const first = booking.items[0];
  const firstDate = first?.requestedStartAt.slice(0, 10);
  const { names: warehouseNames, totalArea } = useBookingWarehouses(booking);
  const msLeft = holdDeadline(booking) - now;
  const isExpiringSoon = msLeft <= EXPIRING_SOON_MS;
  const isPayable = depositStage(booking, now) === 'awaiting';

  return (
    <View className="overflow-hidden rounded-xl border border-warning/40 bg-surface">
      <View className="flex-row items-center justify-between gap-3 bg-warning-bg px-3 py-2">
        <Text className="font-strong text-caption text-warning uppercase tracking-wide">
          Chờ thanh toán cọc
        </Text>
        {booking.expiresAt ? (
          <View className="flex-row items-center gap-1">
            <Timer color={isExpiringSoon ? DANGER : WARNING} size={14} weight="fill" />
            <Text
              className={`font-numeric-strong text-num-sm ${isExpiringSoon ? 'text-danger' : 'text-warning'}`}
            >
              {formatRemaining(msLeft)}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-2.5 px-3 py-3">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <Text className="font-body text-caption text-muted">Mã đặt chỗ</Text>
            <Text className="font-numeric text-foreground text-num-md" numberOfLines={1}>
              {booking.bookingNo}
            </Text>
          </View>
          <CopyChip value={booking.bookingNo} />
        </View>

        <View className="h-px bg-separator" />

        <LedgerRow label="Kho giữ" value={`${booking.items.length} kho (${warehouseNames})`} />
        <LedgerRow label="Tổng diện tích" value={`${formatNumber(totalArea)} m²`} />
        {firstDate && first ? (
          <LedgerRow
            label="Ngày bắt đầu thuê"
            value={`${formatIsoDate(firstDate)} (${first.rentalMonths} tháng)`}
          />
        ) : null}

        <View className="mt-1 flex-row items-end justify-between gap-3 rounded-lg bg-warning-bg px-2.5 py-2">
          <View className="flex-1">
            <Text className="font-strong text-body-sm text-warning">Tiền cọc giữ chỗ</Text>
            <Text className="font-body text-caption text-warning">
              Cần nộp trước khi hết thời gian
            </Text>
          </View>
          <Text className="font-numeric-strong text-num-md text-warning">
            {formatMoney(Number(booking.depositTotal))}
          </Text>
        </View>

        {isPayable ? (
          <Button className="mt-1" onPress={onPay}>
            <Button.Label className="font-ui">Thanh toán ngay</Button.Label>
          </Button>
        ) : null}
      </View>
    </View>
  );
}

/** One line in the history list for a hold that lapsed or was cancelled. */
export function ClosedBookingRow({ booking }: { booking: ApiBooking }) {
  const { names } = useBookingWarehouses(booking);
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-3">
      <View className="flex-1">
        <Text className="font-strong text-body-sm text-foreground" numberOfLines={1}>
          {names}
        </Text>
        <Text className="font-numeric text-caption text-muted" numberOfLines={1}>
          {booking.bookingNo}
        </Text>
      </View>
      <Text className="rounded-full bg-surface-secondary px-2.5 py-1 font-ui text-caption text-muted">
        {booking.status === 'CANCELLED' ? 'Đã hủy' : 'Hết hạn giữ chỗ'}
      </Text>
    </View>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-body text-body-sm text-muted">{label}</Text>
      <Text
        className="flex-1 text-right font-strong text-body-sm text-foreground"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function CopyChip({ value }: { value: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <Pressable
      accessibilityLabel="Sao chép mã đặt chỗ"
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={() => {
        Clipboard.setStringAsync(value);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      }}
    >
      <View className="flex-row items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1.5">
        <Copy color={MUTED} size={13} weight="bold" />
        <Text className="font-ui text-caption text-subtle">{isCopied ? 'Đã chép' : 'Chép'}</Text>
      </View>
    </Pressable>
  );
}
