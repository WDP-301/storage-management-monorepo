import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { isActiveHold } from '../../../lib/booking-hold-state';
import { Button, CardTabs, colors, FlowScreen, InlineMessage, Text } from '../../components/ui';
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
    <FlowScreen muted showBack={false} title="Kho của tôi" titleAlign="left">
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        refreshControl={
          <RefreshControl refreshing={isLoading && totalCount > 0} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4 p-4">
          {error ? (
            <View className="gap-3 rounded-[20px] border border-danger-200 bg-bg-card p-4">
              <InlineMessage message={error} type="error" />
              <Button label="Thử lại" size="sm" variant="secondary" onPress={onRefresh} />
            </View>
          ) : null}

          {isLoading && totalCount === 0 ? (
            <View className="items-center py-12">
              <ActivityIndicator color={colors.semantic.actionPrimary} size="large" />
            </View>
          ) : null}

          {!isLoading && !error && totalCount === 0 ? (
            <View className="items-center rounded-[20px] border border-dashed border-border-default bg-bg-card px-5 py-10">
              <Text className="text-body-lg font-semibold text-text-primary">
                Bạn chưa có kho nào
              </Text>
              <Text className="mt-1 text-center text-body-sm text-text-secondary">
                Chọn kho và lịch thuê để giữ chỗ, đặt cọc rồi nhận kho.
              </Text>
              <View className="mt-5 w-full">
                <Button label="Tìm kho trống" onPress={onBrowse} />
              </View>
            </View>
          ) : null}

          {totalCount > 0 ? (
            <>
              {counts.awaiting > 0 && filter !== 'awaiting' ? (
                <Pressable
                  accessibilityRole="button"
                  className="flex-row items-center justify-between gap-3 rounded-2xl border border-warning-200 bg-warning-0 px-4 py-3"
                  onPress={() => chooseFilter('awaiting')}
                >
                  <Text className="flex-1 text-body-sm font-medium text-warning-700">
                    {counts.awaiting} đặt chỗ cần thanh toán cọc
                  </Text>
                  <Text className="text-body-sm font-semibold text-warning-700">Xem ngay</Text>
                </Pressable>
              ) : null}

              <CardTabs
                tabs={FILTERS.map((item) => ({
                  key: item.key,
                  label: item.label,
                  count: counts[item.key],
                }))}
                value={filter}
                onChange={chooseFilter}
              />

              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-body-md font-semibold text-text-primary">{currentLabel}</Text>
                {pageCount > 1 ? (
                  <Text className="text-caption font-medium text-text-secondary tabular-nums">
                    {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, entries.length)} /{' '}
                    {entries.length}
                  </Text>
                ) : null}
              </View>

              {entries.length === 0 ? (
                <View className="rounded-[20px] border border-border-default bg-bg-card px-4 py-8">
                  <Text className="text-center text-body-sm text-text-secondary">
                    Chưa có kho ở trạng thái “{currentLabel.toLowerCase()}”.
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
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
                <View className="flex-row items-center justify-between gap-2 pt-1">
                  <Button
                    disabled={page === 1}
                    fullWidth={false}
                    label="Trước"
                    leftIcon="chevron-left"
                    size="sm"
                    variant="secondary"
                    onPress={() => choosePage(page - 1)}
                  />
                  <Text className="text-body-sm text-text-secondary tabular-nums">
                    Trang {page} / {pageCount}
                  </Text>
                  <Button
                    disabled={page === pageCount}
                    fullWidth={false}
                    label="Tiếp"
                    rightIcon="chevron-right"
                    size="sm"
                    variant="secondary"
                    onPress={() => choosePage(page + 1)}
                  />
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </FlowScreen>
  );
}
