import { Timer } from 'phosphor-react-native';
import { View } from 'react-native';
import { formatRemaining, holdDeadline } from '../../../lib/booking-hold-state';
import { depositStage } from '../../../lib/booking-payment-state';
import { formatIsoDate, formatMoney, formatNumber } from '../../../lib/format-vi';
import { EXPIRING_SOON_MS } from '../../../lib/hold';
import { Button, colors, Dashed, StatusPill, Text } from '../../components/ui';
import type { ApiBooking } from '../../types/booking-api';
import { useBookingWarehouses } from './use-booking-warehouses';

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
    <View className="overflow-hidden rounded-[20px] border border-warning-200 bg-bg-card">
      <View className="flex-row items-center justify-between gap-3 bg-warning-0 px-4 py-2.5">
        <StatusPill label="Chờ thanh toán cọc" tone={isExpiringSoon ? 'danger' : 'warning'} />
        {booking.expiresAt ? (
          <View className="flex-row items-center gap-1">
            <Timer
              color={isExpiringSoon ? colors.semantic.statusDanger : colors.warning[700]}
              size={14}
              weight="fill"
            />
            <Text
              className={`text-body-sm font-bold tabular-nums ${
                isExpiringSoon ? 'text-status-danger' : 'text-warning-700'
              }`}
            >
              {formatRemaining(msLeft)}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-3 p-4">
        <Text className="text-body-md font-semibold text-text-primary" numberOfLines={2}>
          {warehouseNames}
        </Text>

        <Dashed />

        <LedgerRow label="Số lượng kho" value={`${booking.items.length} kho`} />
        <LedgerRow label="Tổng diện tích" value={`${formatNumber(totalArea)} m²`} />
        {firstDate && first ? (
          <LedgerRow
            label="Ngày bắt đầu thuê"
            value={`${formatIsoDate(firstDate)} (${first.rentalMonths} tháng)`}
          />
        ) : null}

        <View className="flex-row items-center justify-between gap-3 rounded-xl bg-warning-0 px-3.5 py-2.5">
          <View className="flex-1">
            <Text className="text-body-sm font-semibold text-warning-700">Tiền cọc giữ chỗ</Text>
            <Text className="text-caption text-warning-700">Cần nộp trước khi hết thời gian</Text>
          </View>
          <Text className="text-subtitle font-bold text-warning-700 tabular-nums">
            {formatMoney(Number(booking.depositTotal))}
          </Text>
        </View>

        {isPayable ? (
          <Button label="Thanh toán ngay" rightIcon="qr-code-2" onPress={onPay} />
        ) : null}
      </View>
    </View>
  );
}

/** One line in the history list for a hold that lapsed or was cancelled. */
export function ClosedBookingRow({ booking }: { booking: ApiBooking }) {
  const { names } = useBookingWarehouses(booking);
  const isCancelled = booking.status === 'CANCELLED';
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-1 gap-0.5">
        <Text className="text-body-md font-semibold text-text-primary" numberOfLines={1}>
          {names}
        </Text>
        <Text className="text-caption text-text-secondary tabular-nums" numberOfLines={1}>
          {booking.items.length} kho · {formatIsoDate(booking.createdAt.slice(0, 10))}
        </Text>
      </View>
      <StatusPill label={isCancelled ? 'Đã hủy' : 'Hết hạn giữ chỗ'} tone="neutral" />
    </View>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-body-sm text-text-secondary">{label}</Text>
      <Text
        className="flex-1 text-right text-body-sm font-semibold text-text-primary tabular-nums"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
