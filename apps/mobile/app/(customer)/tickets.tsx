import type { TicketStatus } from '@storage/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ApiError } from '../../lib/api';
import { TicketsApi } from '../../lib/tickets-api';
import { MyTicketsScreen } from '../../src/features/customer/MyTicketsScreen';
import type { ServiceTicketRecord, TicketFormOptions } from '../../src/types/ticket-api';

const PAGE_SIZE = 20;

export default function TicketsRoute() {
  const router = useRouter();
  const [tickets, setTickets] = useState<ServiceTicketRecord[]>([]);
  const [options, setOptions] = useState<TicketFormOptions | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: TicketStatus | null, nextPage: number) => {
    const isFirstPage = nextPage === 1;
    if (isFirstPage) setIsLoading(true);
    else setIsLoadingMore(true);
    setError(null);
    try {
      const list = await TicketsApi.listMine({
        page: nextPage,
        limit: PAGE_SIZE,
        ...(status ? { status } : {}),
      });
      setTickets((prev) => (isFirstPage ? list.tickets : [...prev, ...list.tickets]));
      setPage(list.meta.page);
      setHasMore(list.meta.page < list.meta.totalPages);
      if (isFirstPage) {
        // Drives the create CTA; on failure keep the previous payload — a stale options
        // response only mislabels a button, a null one hides it.
        const opts = await TicketsApi.formOptions().catch(() => null);
        if (opts) setOptions(opts);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tải được danh sách yêu cầu.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(statusFilter, 1);
    }, [load, statusFilter]),
  );

  return (
    <MyTicketsScreen
      tickets={tickets}
      options={options}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      statusFilter={statusFilter}
      onFilterStatus={setStatusFilter}
      onRefresh={() => void load(statusFilter, 1)}
      onLoadMore={() => {
        if (hasMore && !isLoading && !isLoadingMore) void load(statusFilter, page + 1);
      }}
      onOpenTicket={(id) => router.navigate(`/(customer)/ticket-detail?id=${id}`)}
      onCreate={() => router.navigate('/(customer)/ticket-create')}
    />
  );
}
