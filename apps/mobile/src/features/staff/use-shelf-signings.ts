import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '../../../lib/api';
import { type ShelfSigning, StaffContractsApi } from '../../../lib/staff-contracts-api';

/** Same cadence as the inspection list, so a newly confirmed shelf booking shows up on its own. */
const POLL_MS = 15_000;

type State = { items: ShelfSigning[]; isLoading: boolean; error: string | null };

/**
 * Shelf contracts waiting at the counter for their signed files and first month — a shelf has no
 * handover, so this is its "Nhận kho" job. Refreshed on focus, on `refetch`, when the app returns
 * to the foreground and every `POLL_MS` while the screen is open.
 */
export function useShelfSignings() {
  const [state, setState] = useState<State>({ items: [], isLoading: true, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      setState((current) => ({ ...current, isLoading: true, error: null }));

      const load = () => {
        StaffContractsApi.shelfSignings(controller.signal)
          .then((items) => {
            if (controller.signal.aborted) return;
            setState({ items, isLoading: false, error: null });
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            const message =
              error instanceof ApiError ? error.message : 'Không tải được danh sách kệ chờ ký.';
            setState((current) => ({ ...current, isLoading: false, error: message }));
          });
      };

      load();
      const timer = setInterval(load, POLL_MS);
      const appState = AppState.addEventListener('change', (next) => {
        if (next === 'active') load();
      });

      return () => {
        clearInterval(timer);
        appState.remove();
        controller.abort();
      };
      // reloadToken re-runs the load on pull-to-refresh.
    }, [reloadToken]),
  );

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);
  return { ...state, refetch };
}
