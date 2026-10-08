import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { ContractsApi } from '../../../lib/contracts-api';
import type { ApiContract } from '../../types/contract-api';

type MyContractsState = {
  contracts: ApiContract[];
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: MyContractsState = {
  contracts: [],
  isLoading: true,
  error: null,
};

/** Contracts of the signed-in customer — the "Kho của tôi" list. */
export function useMyContracts() {
  const [state, setState] = useState<MyContractsState>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, isLoading: true, error: null }));

    const load = async () => {
      try {
        const contracts = await ContractsApi.listMine(controller.signal);
        if (controller.signal.aborted) return;
        setState({ contracts, isLoading: false, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, isLoading: false, error: toErrorMessage(error) }));
      }
    };

    void load();

    return () => controller.abort();
  }, [reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}

function toErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Không tải được danh sách kho. Vui lòng thử lại.';
}
