import type { TicketStatus } from '@storage/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { TicketsApi } from '../../../lib/tickets-api';
import type { ServiceTicketRecord } from '../../types/ticket-api';

const PAGE_SIZE = 20;

/**
 * Tickets the signed-in staff member may work on. The API scopes the list by role — staff get
 * tickets assigned to them, facility managers every ticket of their facilities — so no
 * filtering happens here. Reloads whenever the tab regains focus.
 */
export function useStaffTickets() {
  const [tickets, setTickets] = useState<ServiceTicketRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Switching filters quickly leaves earlier requests in flight; only the latest may write.
  const latestRequest = useRef(0);

  const load = useCallback(async (status: TicketStatus | null, nextPage: number) => {
    const request = ++latestRequest.current;
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
      if (request !== latestRequest.current) return;
      setTickets((prev) => (isFirstPage ? list.tickets : [...prev, ...list.tickets]));
      setPage(list.meta.page);
      setHasMore(list.meta.page < list.meta.totalPages);
    } catch (e) {
      if (request !== latestRequest.current) return;
      setError(e instanceof ApiError ? e.message : 'Không tải được danh sách yêu cầu.');
    } finally {
      if (request === latestRequest.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(statusFilter, 1);
    }, [load, statusFilter]),
  );

  return {
    tickets,
    statusFilter,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    setStatusFilter,
    refresh: () => void load(statusFilter, 1),
    loadMore: () => {
      if (hasMore && !isLoading && !isLoadingMore) void load(statusFilter, page + 1);
    },
  };
}
