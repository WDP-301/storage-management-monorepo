import { Button } from 'heroui-native';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { isActiveHold } from '../../../lib/booking-hold-state';
import type { ApiBooking } from '../../types/booking-api';
import type { ApiContract } from '../../types/contract-api';
import { BookingHoldCard, ClosedBookingRow } from './BookingHoldCard';
import { ContractCard } from './ContractCard';

type Props = {
  bookings: ApiBooking[];
  contracts: ApiContract[];
  now: number;
  isLoading: boolean;
  error: string | null;
  contentBottomPadding: number;
  onBrowse: () => void;
  onRefresh: () => void;
  onPay: (bookingId: string) => void;
  onDetail: (contractId: string) => void;
};

type Filter = 'active' | 'upcoming' | 'awaiting' | 'history';
type Entry =
  | { kind: 'contract'; contract: ApiContract }
  | { kind: 'hold' | 'closed'; booking: ApiBooking };

const PAGE_SIZE = 4;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: 'Đang thuê' },
  { key: 'upcoming', label: 'Đã cọc' },
  { key: 'awaiting', label: 'Chờ cọc' },
  { key: 'history', label: 'Lịch sử' },
];

/** A confirmed booking is represented by its contract, never shown a second time. */
function groupStorage(bookings: ApiBooking[], contracts: ApiContract[], now: number) {
  const awaiting = bookings
    .filter((booking) => isActiveHold(booking, now))
    .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''));
  const closedBookings = bookings
    .filter((booking) => booking.status !== 'CONFIRMED' && !isActiveHold(booking, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    awaiting,
    upcoming: contracts
      .filter((contract) => contract.status === 'DRAFT')
      .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)),
    active: contracts
      .filter((contract) => contract.status === 'ACTIVE')
      .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt)),
    pastContracts: contracts
      .filter((contract) => contract.status === 'ENDED' || contract.status === 'CANCELLED')
      .sort((a, b) => (b.endedAt ?? b.effectiveAt).localeCompare(a.endedAt ?? a.effectiveAt)),
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
  const [selectedFilter, setSelectedFilter] = useState<Filter | null>(null);
  const [requestedPage, setRequestedPage] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const groups = groupStorage(bookings, contracts, now);
  const counts: Record<Filter, number> = {
    active: groups.active.length,
    upcoming: groups.upcoming.length,
    awaiting: groups.awaiting.length,
    history: groups.pastContracts.length + groups.closedBookings.length,
  };
  const totalCount = Object.values(counts).reduce((total, count) => total + count, 0);
  const filter: Filter =
    selectedFilter ??
    (counts.active
      ? 'active'
      : counts.awaiting
        ? 'awaiting'
        : counts.upcoming
          ? 'upcoming'
          : 'history');
  const entries: Entry[] =
    filter === 'active'
      ? groups.active.map((contract) => ({ kind: 'contract', contract }))
      : filter === 'upcoming'
        ? groups.upcoming.map((contract) => ({ kind: 'contract', contract }))
        : filter === 'awaiting'
          ? groups.awaiting.map((booking) => ({ kind: 'hold', booking }))
          : [
              ...groups.pastContracts.map((contract) => ({ kind: 'contract' as const, contract })),
              ...groups.closedBookings.map((booking) => ({ kind: 'closed' as const, booking })),
            ];
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const currentLabel = FILTERS.find((item) => item.key === filter)?.label ?? '';

  const chooseFilter = (next: Filter) => {
    setSelectedFilter(next);
    setRequestedPage(1);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const choosePage = (next: number) => {
    setRequestedPage(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      refreshControl={
        <RefreshControl refreshing={isLoading && totalCount > 0} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pt-5 pb-4">
        <Text className="font-strong text-foreground text-title-md">Kho của tôi</Text>
        <Text className="font-body mt-1 text-body-sm text-muted">
          Theo dõi kho đang thuê, đặt cọc và lịch sử.
        </Text>

        {error ? (
          <View className="mt-4 rounded-xl border border-danger/30 bg-danger-bg p-3">
            <Text className="font-body text-body-sm text-danger">{error}</Text>
            <Button className="mt-3" size="sm" variant="secondary" onPress={onRefresh}>
              <Button.Label className="font-ui">Thử lại</Button.Label>
            </Button>
          </View>
        ) : null}

        {isLoading && totalCount === 0 ? (
          <View className="items-center py-12">
            <ActivityIndicator />
          </View>
        ) : null}

        {!isLoading && totalCount === 0 ? (
          <View className="mt-5 items-center rounded-2xl border border-border border-dashed px-5 py-10">
            <Text className="font-strong text-body-md text-foreground">Bạn chưa có kho nào</Text>
            <Text className="font-body mt-1 text-center text-body-sm text-muted">
              Chọn kho và lịch thuê để giữ chỗ, đặt cọc rồi nhận kho.
            </Text>
            <Button className="mt-5" onPress={onBrowse}>
              <Button.Label className="font-ui">Tìm kho trống</Button.Label>
            </Button>
          </View>
        ) : null}

        {totalCount > 0 ? (
          <>
            {counts.awaiting > 0 && filter !== 'awaiting' ? (
              <Pressable
                accessibilityRole="button"
                className="mt-5 flex-row items-center justify-between gap-3 rounded-xl bg-warning-bg px-3 py-3"
                onPress={() => chooseFilter('awaiting')}
              >
                <Text className="flex-1 font-ui text-body-sm text-warning">
                  {counts.awaiting} đặt chỗ cần thanh toán cọc
                </Text>
                <Text className="font-strong text-body-sm text-warning">Xem ngay</Text>
              </Pressable>
            ) : null}

            <ScrollView
              className="-mx-4 mt-5"
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {FILTERS.map((item) => {
                const selected = filter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2.5 ${selected ? 'bg-foreground' : 'bg-surface-secondary'}`}
                    onPress={() => chooseFilter(item.key)}
                  >
                    <Text
                      className={`font-ui text-body-sm ${selected ? 'text-background' : 'text-muted'}`}
                    >
                      {item.label}
                    </Text>
                    <Text
                      className={`font-numeric text-caption ${selected ? 'text-background' : 'text-muted'}`}
                    >
                      {counts[item.key]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mt-5 flex-row items-center justify-between gap-2">
              <Text className="font-strong text-body-md text-foreground">{currentLabel}</Text>
              {entries.length > 0 ? (
                <Text className="font-numeric text-caption text-muted">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, entries.length)} /{' '}
                  {entries.length}
                </Text>
              ) : null}
            </View>

            {entries.length === 0 ? (
              <View className="mt-3 rounded-xl border border-border bg-surface px-4 py-8">
                <Text className="text-center font-body text-body-sm text-muted">
                  Chưa có kho ở trạng thái “{currentLabel.toLowerCase()}”.
                </Text>
              </View>
            ) : (
              <View className="mt-3 gap-3">
                {pageEntries.map((entry) =>
                  entry.kind === 'contract' ? (
                    <ContractCard
                      key={entry.contract.id}
                      contract={entry.contract}
                      now={now}
                      onPress={() => onDetail(entry.contract.id)}
                    />
                  ) : entry.kind === 'hold' ? (
                    <BookingHoldCard
                      key={entry.booking.id}
                      booking={entry.booking}
                      now={now}
                      onPay={() => onPay(entry.booking.id)}
                    />
                  ) : (
                    <ClosedBookingRow key={entry.booking.id} booking={entry.booking} />
                  ),
                )}
              </View>
            )}

            {pageCount > 1 ? (
              <View className="mt-5 flex-row items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={page === 1}
                  onPress={() => choosePage(page - 1)}
                >
                  <CaretLeft size={16} />
                  <Button.Label>Trước</Button.Label>
                </Button>
                <Text className="font-numeric text-body-sm text-muted">
                  Trang {page} / {pageCount}
                </Text>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={page === pageCount}
                  onPress={() => choosePage(page + 1)}
                >
                  <Button.Label>Tiếp</Button.Label>
                  <CaretRight size={16} />
                </Button>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
