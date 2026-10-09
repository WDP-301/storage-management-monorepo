import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { InspectionsApi } from '../../../lib/inspections-api';
import { useSession } from '../../../lib/session';
import type { InspectionListStatus, StaffInspection } from '../../types/inspection-api';

type State = {
  /** scope+status the items belong to; a different one means they are stale. */
  key: string;
  items: StaffInspection[];
  isLoading: boolean;
  error: string | null;
};

/**
 * Inspections for the staff area, refreshed on every focus. Facility managers see their whole
 * facility; staff only what is assigned to them.
 */
export function useStaffInspections(status: InspectionListStatus) {
  const { user } = useSession();
  const scope = user?.roles.includes('FACILITY_MANAGER') ? 'managed' : 'assigned';
  const [state, setState] = useState<State>({ key: '', items: [], isLoading: true, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      const key = `${scope}:${status}`;
      // Another segment's rows must not show under this one while it loads (or if it fails).
      setState((current) =>
        current.key === key
          ? { ...current, isLoading: true, error: null }
          : { key, items: [], isLoading: true, error: null },
      );
      InspectionsApi.list(scope, status, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setState({ key, items, isLoading: false, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            error instanceof ApiError ? error.message : 'Không tải được danh sách biên bản.';
          setState((current) => ({ ...current, isLoading: false, error: message }));
        });
      return () => controller.abort();
      // reloadToken re-runs the load on pull-to-refresh.
    }, [scope, status, reloadToken]),
  );

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);
  const { items, isLoading, error } = state;
  return { items, isLoading, error, refetch };
}
