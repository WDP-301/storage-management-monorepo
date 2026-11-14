import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { NotificationsApi } from '../../../lib/notifications-api';
import { useUnreadNotifications } from '../../../lib/notifications-unread';
import type { NotificationRecord } from '../../types/notification-api';

/** What the list is busy with; `idle` also covers a quiet reload when the tab regains focus. */
type LoadPhase = 'idle' | 'initial' | 'refreshing' | 'more';

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** The customer's inbox: paged list, pull to refresh, and optimistic read state. */
export function useNotifications() {
  const { unread, adjust, setUnread, refresh: refreshUnread } = useUnreadNotifications();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [phase, setPhase] = useState<LoadPhase>('initial');
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pageRef = useRef(page);
  pageRef.current = page;
  const controllerRef = useRef<AbortController | null>(null);

  // Only the newest load may touch state: starting one aborts the previous, so a slow page two can
  // never land on top of a fresh page one.
  const load = useCallback(async (nextPage: number, loadPhase: LoadPhase) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase(loadPhase);
    setError(null);
    try {
      const response = await NotificationsApi.list(nextPage, false, controller.signal);
      if (controller.signal.aborted) return;
      setItems(response.notifications);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(toMessage(e, 'Không tải được thông báo. Vui lòng thử lại.'));
    } finally {
      if (controllerRef.current === controller) setPhase('idle');
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Tab bar buttons only navigate, so the screen stays mounted: reload whenever it regains focus.
  useFocusEffect(
    useCallback(() => {
      void load(pageRef.current, itemsRef.current.length === 0 ? 'initial' : 'idle');
      void refreshUnread();
    }, [load, refreshUnread]),
  );

  const refresh = useCallback(() => {
    void load(1, 'refreshing');
    void refreshUnread();
  }, [load, refreshUnread]);

  const goToPage = useCallback(
    (next: number) => {
      if (phase !== 'idle' || next === page || next < 1 || next > totalPages) return;
      void load(next, 'more');
    },
    [phase, page, totalPages, load],
  );

  const markRead = useCallback(
    async (id: string) => {
      const target = itemsRef.current.find((item) => item.id === id);
      if (!target || target.read_at) return;
      const readAt = new Date().toISOString();
      const setReadAt = (value: string | null) =>
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, read_at: value } : item)),
        );
      setReadAt(readAt);
      adjust(-1);
      try {
        await NotificationsApi.markRead(id);
        void refreshUnread();
      } catch (e) {
        setReadAt(null);
        adjust(1);
        setError(toMessage(e, 'Không đánh dấu được đã đọc. Vui lòng thử lại.'));
      }
    },
    [adjust, refreshUnread],
  );

  const markAllRead = useCallback(async () => {
    if (isMarkingAll || unread === 0) return;
    setIsMarkingAll(true);
    const previousItems = itemsRef.current;
    const previousUnread = unread;
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: readAt })),
    );
    setUnread(0);
    try {
      await NotificationsApi.markAllRead();
      void refreshUnread();
    } catch (e) {
      setItems(previousItems);
      setUnread(previousUnread);
      setError(toMessage(e, 'Không đánh dấu được tất cả đã đọc. Vui lòng thử lại.'));
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, unread, setUnread, refreshUnread]);

  return {
    items,
    unread,
    error,
    page,
    totalPages,
    isMarkingAll,
    isLoading: phase === 'initial',
    isRefreshing: phase === 'refreshing',
    isChangingPage: phase === 'more',
    refresh,
    goToPage,
    markRead,
    markAllRead,
  };
}
