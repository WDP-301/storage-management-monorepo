import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { ChangeRequestsApi, type UnitChangeRequest } from '../../../lib/change-requests-api';

export type UnitChangeRequestsState = {
  requests: UnitChangeRequest[];
  isLoading: boolean;
  error: string | null;
};

/**
 * The customer's unit-change requests, loaded on focus and on `reload`.
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
      setState((current) => ({ ...current, isLoading: true, error: null }));
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
      return () => controller.abort();
    }, [enabled, reloadToken]),
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return { ...state, reload };
}
