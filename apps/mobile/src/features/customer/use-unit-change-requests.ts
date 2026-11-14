import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ChangeRequestsApi, type UnitChangeRequest } from '../../../lib/change-requests-api';

/** How often an open screen re-reads the requests, so a manager's decision shows up on its own. */
const POLL_MS = 15_000;

export type UnitChangeRequestsState = {
  requests: UnitChangeRequest[];
  isLoading: boolean;
  error: string | null;
};

/**
 * The customer's unit-change requests, loaded on focus, on `reload`, when the app returns to the
 * foreground, and every `POLL_MS` while the screen is open — a manager's approval happens on the
 * back office, so the card must catch up without the customer navigating away and back.
 * Scoped by `enabled` so ended contracts never fire the request.
 */
export function useUnitChangeRequests(enabled: boolean) {
  const [state, setState] = useState<UnitChangeRequestsState>({
    requests: [],
    isLoading: false,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const controller = new AbortController();

      const load = () => {
        ChangeRequestsApi.listMine(controller.signal)
          .then((requests) => {
            if (controller.signal.aborted) return;
            setState({ requests, isLoading: false, error: null });
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            const message =
              error instanceof ApiError
                ? error.message
                : 'Không tải được yêu cầu đổi kho. Vui lòng thử lại.';
            setState((current) => ({ ...current, isLoading: false, error: message }));
          });
      };

      setState((current) => ({ ...current, isLoading: true, error: null }));
      load();
      const timer = setInterval(load, POLL_MS);
      const appState = AppState.addEventListener('change', (status) => {
        if (status === 'active') load();
      });

      return () => {
        clearInterval(timer);
        appState.remove();
        controller.abort();
      };
    }, [enabled, reloadToken]),
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return { ...state, reload };
}
