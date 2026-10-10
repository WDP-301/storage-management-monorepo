import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { type StaffContract, StaffContractsApi } from '../../../lib/staff-contracts-api';

/** The contract a staff member works on, refreshed on every focus and via `reload`. */
export function useStaffContract(id: string | undefined) {
  const [contract, setContract] = useState<StaffContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // The route stays mounted across contracts: results for a previous id are dropped.
  const idRef = useRef(id);
  idRef.current = id;
  // Focus loads and explicit reloads overlap; only the most recently started one may land,
  // or an older response could roll back files or permissions the screen already shows.
  const seqRef = useRef(0);

  useEffect(() => {
    setContract(null);
    setError(id ? null : 'Không tìm thấy hợp đồng.');
    setIsLoading(!!id);
  }, [id]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      const seq = ++seqRef.current;
      const stale = () => signal?.aborted || idRef.current !== id || seqRef.current !== seq;
      setIsLoading(true);
      try {
        const loaded = await StaffContractsApi.get(id, signal);
        if (stale()) return;
        setContract(loaded);
        setError(null);
      } catch (err) {
        if (stale()) return;
        setError(loadErrorMessage(err));
      } finally {
        if (!stale()) setIsLoading(false);
      }
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  return { contract, error, isLoading, reload: load };
}

function loadErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không tải được hợp đồng.';
  if (err.statusCode === 403) return 'Bạn không có quyền với hợp đồng này.';
  if (err.statusCode === 404) return 'Không tìm thấy hợp đồng.';
  return err.message || 'Không tải được hợp đồng.';
}
