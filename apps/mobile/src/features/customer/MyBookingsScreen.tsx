import * as Clipboard from 'expo-clipboard';
import { Button } from 'heroui-native';
import { Copy, Timer } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  formatRemaining,
  holdDeadline,
  holdState,
  isActiveHold,
} from '../../../lib/booking-hold-state';
import { depositStage } from '../../../lib/booking-payment-state';
import { formatIsoDate, formatMoney, formatNumber } from '../../../lib/format-vi';
import { rentalEndIso } from '../../../lib/rental-schedule';
import type { ApiBooking } from '../../types/booking-api';

type Props = {
  bookings: ApiBooking[];
  /** Shared clock from the hold provider, so this list and the countdown bar never disagree. */
  now: number;
  isLoading: boolean;
  error: string | null;
  contentBottomPadding: number;
  onBrowse: () => void;
  onRefresh: () => void;
  onPay: (bookingId: string) => void;
};

/** Mirror the colour tokens in global.css; SVG icons cannot read a Tailwind class. */
const DANGER = 'hsl(0 72% 51%)';
const MUTED = 'hsl(215 16% 47%)';

type BookingFilter = 'all' | 'awaiting' | 'active' | 'closed';
const PAGE_SIZE = 5;

/**
 * One tone per booking state, carried by the card outline, the status label and the tinted strip
 * so the state is legible from the edge of the card before any text is read.
 */
const STATE_STYLES = {
  awaiting: {
    card: 'border-warning/40',
    strip: 'bg-warning-bg',
    label: 'text-warning',
    badge: 'bg-warning-bg',
  },
  active: {
    card: 'border-success/40',
    strip: 'bg-success-bg',
    label: 'text-success',
    badge: 'bg-success-bg',
  },
  closed: {
    card: 'border-border',
    strip: 'bg-surface-secondary',
    label: 'text-muted',
    badge: 'bg-surface-secondary',
  },
} as const;

type BookingState = keyof typeof STATE_STYLES;

/**
 * Classifies a booking into the three states the customer cares about: money is owed, the rental
 * is running, or it is over. A lapsed hold counts as closed even when the status still says
 * HOLDING, because the rooms are already back on the market.
 */
function bookingState(booking: ApiBooking, now: number): BookingState {
  if (holdState(booking, now) === 'expired' || booking.status === 'CANCELLED') return 'closed';
  if (booking.status === 'CONFIRMED') return 'active';
  if (isActiveHold(booking, now)) return 'awaiting';
  return 'closed';
}

const STATE_LABELS: Record<BookingState, string> = {
  awaiting: 'Chờ thanh toán cọc',
  active: 'Đang thuê',
  closed: 'Đã kết thúc',
};

export function MyBookingsScreen({
  bookings,
  now,
  isLoading,
  error,
  contentBottomPadding,
  onBrowse,
  onRefresh,
  onPay,
}: Props) {
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [page, setPage] = useState(1);
  const scrollRef = useRef<ScrollView>(null);

  const withState = bookings.map((booking) => ({
    booking,
    state: bookingState(booking, now),
  }));
  const counts = {
    all: withState.length,
    awaiting: withState.filter((entry) => entry.state === 'awaiting').length,
    active: withState.filter((entry) => entry.state === 'active').length,
    closed: withState.filter((entry) => entry.state === 'closed').length,
  };
  const visible = filter === 'all' ? withState : withState.filter((e) => e.state === filter);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // A refreshed booking can leave the last page empty, so clamp the displayed page immediately.
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageBookings = visible.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const changeFilter = (next: BookingFilter) => {
    setFilter(next);
    setPage(1);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const changePage = (next: number) => {
    setPage(Math.max(1, Math.min(next, pageCount)));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      refreshControl={
        <RefreshControl refreshing={isLoading && bookings.length > 0} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pt-5 pb-3">
        <Text className="font-strong text-foreground text-title-md">Đặt chỗ của tôi</Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          Quản lý kho đang giữ, thanh toán cọc và hợp đồng
        </Text>
      </View>

      {/* Filter pills carry their own counts: the number is the reason to tap, and "Chờ thanh toán
          (1)" is the one the customer opens this screen for. */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <FilterPill
          isSelected={filter === 'all'}
          label={`Tất cả (${counts.all})`}
          onPress={() => changeFilter('all')}
        />
        <FilterPill
          isSelected={filter === 'awaiting'}
          label={`Chờ thanh toán (${counts.awaiting})`}
          onPress={() => changeFilter('awaiting')}
        />
        <FilterPill
          isSelected={filter === 'active'}
          label={`Đang thuê (${counts.active})`}
          onPress={() => changeFilter('active')}
        />
        <FilterPill
          isSelected={filter === 'closed'}
          label={`Đã kết thúc (${counts.closed})`}
          onPress={() => changeFilter('closed')}
        />
      </ScrollView>

      <View className="gap-3 px-4 pt-4">
        {error ? (
          <View className="rounded-xl border border-danger/30 bg-danger-bg p-3">
            <Text className="font-body text-body-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRefresh}>
              <Button.Label className="font-ui">Thử lại</Button.Label>
            </Button>
          </View>
        ) : null}

        {isLoading && bookings.length === 0 ? <ActivityIndicator /> : null}

        {visible.length === 0 && !isLoading ? (
          <View className="items-center rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">
              {filter === 'all' ? 'Chưa có đặt chỗ nào' : 'Không có đặt chỗ ở trạng thái này'}
            </Text>
            <Text className="font-body mt-1 text-center text-body-sm text-muted">
              Chọn kho và lịch thuê để giữ chỗ trước khi thanh toán.
            </Text>
            <Button className="mt-5" variant="secondary" onPress={onBrowse}>
              <Button.Label className="font-ui">Tìm kho trống</Button.Label>
            </Button>
          </View>
        ) : null}

        {pageBookings.map(({ booking, state }) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            now={now}
            state={state}
            onPay={() => onPay(booking.id)}
          />
        ))}

        {visible.length > 0 ? (
          <View className="gap-3 pt-2">
            <Text className="font-body text-center text-caption text-muted">
              Hiển thị {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, visible.length)} /{' '}
              {visible.length} đặt chỗ
            </Text>
            {pageCount > 1 ? (
              <View className="flex-row items-center justify-between gap-3">
                <Button
                  isDisabled={currentPage === 1}
                  size="sm"
                  variant="secondary"
                  onPress={() => changePage(currentPage - 1)}
                >
                  <Button.Label className="font-ui">Trang trước</Button.Label>
                </Button>
                <Text className="font-strong text-body-sm text-foreground">
                  {currentPage} / {pageCount}
                </Text>
                <Button
                  isDisabled={currentPage === pageCount}
                  size="sm"
                  variant="secondary"
                  onPress={() => changePage(currentPage + 1)}
                >
                  <Button.Label className="font-ui">Trang sau</Button.Label>
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function BookingCard({
  booking,
  now,
  state,
  onPay,
}: {
  booking: ApiBooking;
  now: number;
  state: BookingState;
  onPay: () => void;
}) {
  const styles = STATE_STYLES[state];
  const first = booking.items[0];
  const firstDate = first?.requestedStartAt.slice(0, 10);
  const unitCodes = booking.items
    .map((item) => item.storageUnit?.code ?? item.storageUnitId)
    .join(', ');
  const totalArea = booking.items.reduce(
    (sum, item) => sum + Number(item.storageUnit?.areaM2 ?? 0),
    0,
  );
  const isPayable = depositStage(booking, now) === 'awaiting';
  const daysLeft =
    state === 'active' && firstDate && first
      ? Math.max(
          0,
          Math.ceil(
            (new Date(rentalEndIso(firstDate, first.rentalMonths)).getTime() - now) / 86_400_000,
          ),
        )
      : null;

  return (
    <View className={`overflow-hidden rounded-xl border bg-surface ${styles.card}`}>
      <View className={`flex-row items-center justify-between gap-3 px-3 py-2 ${styles.strip}`}>
        <Text className={`font-strong text-caption uppercase tracking-wide ${styles.label}`}>
          {STATE_LABELS[state]}
        </Text>
        {state === 'awaiting' && booking.expiresAt ? (
          <View className="flex-row items-center gap-1">
            <Timer color={DANGER} size={14} weight="fill" />
            <Text className="font-numeric-strong text-danger text-num-sm">
              {formatRemaining(holdDeadline(booking) - now)}
            </Text>
          </View>
        ) : daysLeft !== null ? (
          <Text className={`font-ui text-caption ${styles.label}`}>Còn {daysLeft} ngày</Text>
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

        <LedgerRow label="Số lượng kho" value={`${booking.items.length} kho (${unitCodes})`} />
        <LedgerRow label="Tổng diện tích" value={`${formatNumber(totalArea)} m²`} />
        {firstDate && first ? (
          <LedgerRow
            label="Ngày bắt đầu thuê"
            value={`${formatIsoDate(firstDate)} (${first.rentalMonths} tháng)`}
          />
        ) : null}

        <View
          className={`mt-1 flex-row items-end justify-between gap-3 rounded-lg px-2.5 py-2 ${styles.badge}`}
        >
          <View className="flex-1">
            <Text className={`font-strong text-body-sm ${styles.label}`}>
              {state === 'awaiting'
                ? 'Tiền cọc giữ chỗ'
                : state === 'active'
                  ? 'Tiền cọc đã nộp'
                  : 'Tiền cọc theo đơn'}
            </Text>
            {state === 'awaiting' ? (
              <Text className={`font-body text-caption ${styles.label}`}>
                Cần nộp trước khi hết thời gian
              </Text>
            ) : null}
          </View>
          <Text className={`font-numeric-strong text-num-md ${styles.label}`}>
            {formatMoney(Number(booking.depositTotal))}
          </Text>
        </View>

        {state === 'awaiting' && isPayable ? (
          <Button className="mt-1" onPress={onPay}>
            <Button.Label className="font-ui">Thanh toán ngay</Button.Label>
          </Button>
        ) : null}

        {state === 'closed' ? (
          <Text className="font-body text-body-sm text-muted">
            Kho đã được mở lại cho khách khác. Chọn kho mới nếu bạn vẫn cần chỗ.
          </Text>
        ) : null}
      </View>
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

function FilterPill({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View
        className={`rounded-full border px-3.5 py-2 ${
          isSelected ? 'border-foreground bg-foreground' : 'border-border bg-surface'
        }`}
      >
        <Text className={`font-ui text-body-sm ${isSelected ? 'text-surface' : 'text-subtle'}`}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
