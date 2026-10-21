import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { InvoicesApi } from '../../../lib/invoices-api';
import type { ApiInvoice } from '../../types/invoice-api';

export type ContractInvoicesState = {
  invoices: ApiInvoice[];
  isLoading: boolean;
  error: string | null;
};

/** Invoices of one contract, loaded on focus and on `reload`; null `contractId` loads nothing. */
export function useContractInvoices(contractId: string | null) {
  const [state, setState] = useState<ContractInvoicesState>({
    invoices: [],
    isLoading: false,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!contractId) return;
      const controller = new AbortController();
      setState((current) => ({ ...current, isLoading: true, error: null }));
      InvoicesApi.listForContract(contractId, controller.signal)
        .then((invoices) => {
          if (!controller.signal.aborted) setState({ invoices, isLoading: false, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            error instanceof ApiError ? error.message : 'Không tải được hoá đơn. Vui lòng thử lại.';
          setState((current) => ({ ...current, isLoading: false, error: message }));
        });
      return () => controller.abort();
    }, [contractId, reloadToken]),
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return { ...state, reload };
}
