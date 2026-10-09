import { Button } from 'heroui-native';
import { CaretDown, CaretUp } from 'phosphor-react-native';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { isActiveHold } from '../../../lib/booking-hold-state';
import type { ApiBooking } from '../../types/booking-api';
import type { ApiContract } from '../../types/contract-api';
import { BookingHoldCard, ClosedBookingRow } from './BookingHoldCard';
import { ContractCard } from './ContractCard';

type Props = {
  bookings: ApiBooking[];
  contracts: ApiContract[];
  /** Shared clock from the hold provider, so hold cards and the countdown bar never disagree. */
  now: number;
  isLoading: boolean;
  error: string | null;
  contentBottomPadding: number;
  onBrowse: () => void;
  onRefresh: () => void;
  onPay: (bookingId: string) => void;
  onDetail: (contractId: string) => void;
};

const MUTED = 'hsl(215 16% 47%)';

/**
 * Everything the customer has taken, one entry per warehouse journey: an unpaid hold shows as its
 * booking, and once the deposit lands the contract takes over — a paid booking is never listed
 * next to its own contract.
 */
function groupStorage(bookings: ApiBooking[], contracts: ApiContract[], now: number) {
  const awaiting = bookings.filter((booking) => isActiveHold(booking, now));
  // Anything neither paid nor still holding: lapsed, cancelled, or a hold with no deadline.
  const closedBookings = bookings.filter(
    (booking) => booking.status !== 'CONFIRMED' && !isActiveHold(booking, now),
  );
  return {
    awaiting,
    upcoming: contracts.filter((contract) => contract.status === 'DRAFT'),
    active: contracts.filter((contract) => contract.status === 'ACTIVE'),
    pastContracts: contracts.filter(
      (contract) => contract.status === 'ENDED' || contract.status === 'CANCELLED',
    ),
    closedBookings,
  };
}

export function MyStorageScreen({
  bookings,
  contracts,
  now,
  isLoading,
  error,
  contentBottomPadding,
  onBrowse,
  onRefresh,
  onPay,
  onDetail,
}: Props) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const groups = groupStorage(bookings, contracts, now);
  const historyCount = groups.pastContracts.length + groups.closedBookings.length;
  const currentCount = groups.awaiting.length + groups.upcoming.length + groups.active.length;
  const isEmpty = currentCount === 0 && historyCount === 0;

  const contractCards = (list: ApiContract[]) =>
    list.map((contract) => (
      <ContractCard
        key={contract.id}
        contract={contract}
        now={now}
        onPress={() => onDetail(contract.id)}
      />
    ));

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      refreshControl={<RefreshControl refreshing={isLoading && !isEmpty} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pt-5 pb-4">
        <Text className="font-strong text-foreground text-title-md">Kho của tôi</Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          Kho đang giữ chỗ, đã cọc và đang thuê.
        </Text>

        {error ? (
          <View className="mt-4 rounded-xl border border-danger/30 bg-danger-bg p-3">
            <Text className="font-body text-body-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRefresh}>
              <Button.Label className="font-ui">Thử lại</Button.Label>
            </Button>
          </View>
        ) : null}

        {isLoading && isEmpty ? (
          <View className="items-center py-12">
            <ActivityIndicator />
          </View>
        ) : null}

        {!isLoading && currentCount === 0 ? (
          <View className="mt-4 items-center rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">Bạn chưa thuê kho nào</Text>
            <Text className="font-body mt-1 text-center text-body-sm text-muted">
              Chọn kho và lịch thuê để giữ chỗ, đặt cọc rồi nhận kho.
            </Text>
            <Button className="mt-5" onPress={onBrowse}>
              <Button.Label className="font-ui">Tìm kho trống</Button.Label>
            </Button>
          </View>
        ) : null}

        <Section title="Cần thanh toán cọc" count={groups.awaiting.length}>
          {groups.awaiting.map((booking) => (
            <BookingHoldCard
              key={booking.id}
              booking={booking}
              now={now}
              onPay={() => onPay(booking.id)}
            />
          ))}
        </Section>
        <Section title="Sắp nhận kho" count={groups.upcoming.length}>
          {contractCards(groups.upcoming)}
        </Section>
        <Section title="Đang thuê" count={groups.active.length}>
          {contractCards(groups.active)}
        </Section>

        {historyCount > 0 ? (
          <View className="mt-6">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isHistoryOpen }}
              className="flex-row items-center justify-between py-2"
              onPress={() => setIsHistoryOpen((open) => !open)}
            >
              <Text className="font-ui text-caption text-muted uppercase tracking-wide">
                Lịch sử ({historyCount})
              </Text>
              {isHistoryOpen ? (
                <CaretUp color={MUTED} size={16} weight="bold" />
              ) : (
                <CaretDown color={MUTED} size={16} weight="bold" />
              )}
            </Pressable>
            {isHistoryOpen ? (
              <View className="mt-1 gap-3">
                {contractCards(groups.pastContracts)}
                {groups.closedBookings.map((booking) => (
                  <ClosedBookingRow key={booking.id} booking={booking} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <View className="mt-5 gap-3">
      <Text className="font-ui text-caption text-muted uppercase tracking-wide">
        {title} ({count})
      </Text>
      {children}
    </View>
  );
}
