import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { NotificationsApi } from './notifications-api';

type UnreadContextValue = {
  /** Notifications not read yet; drives the tab badge. */
  unread: number;
  /** Re-reads the count from the API; a failure keeps the number already shown. */
  refresh: () => Promise<void>;
  /** Applies a local change right away (e.g. after tapping a notification) before the API confirms. */
  adjust: (delta: number) => void;
  setUnread: (count: number) => void;
};

const UnreadContext = createContext<UnreadContextValue | null>(null);

/**
 * Holds the unread count for the customer tab bar. It refreshes on mount and whenever the app
 * returns to the foreground — there is no push and no polling, so that is how new mail shows up.
 */
export function NotificationsUnreadProvider({ children }: { children: ReactNode }) {
  const [unread, setUnreadState] = useState(0);
  // Every refresh and local change takes a new number; only the latest may write the state, so a
  // slow response can never overwrite a count the user has since changed by reading mail.
  const latestChange = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++latestChange.current;
    try {
      const count = await NotificationsApi.unreadCount();
      if (mine === latestChange.current) setUnreadState(count);
    } catch {
      // A badge is a hint, not data the user acts on: keep the last known count and retry on the
      // next foreground or tab open instead of interrupting them.
    }
  }, []);

  const setUnread = useCallback((count: number) => {
    latestChange.current += 1;
    setUnreadState(Math.max(0, count));
  }, []);

  const adjust = useCallback((delta: number) => {
    latestChange.current += 1;
    setUnreadState((current) => Math.max(0, current + delta));
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      subscription.remove();
      // Invalidates any request still in flight so it cannot write after unmount.
      latestChange.current += 1;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ unread, refresh, adjust, setUnread }),
    [unread, refresh, adjust, setUnread],
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnreadNotifications() {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnreadNotifications must be used inside NotificationsUnreadProvider.');
  }
  return context;
}
