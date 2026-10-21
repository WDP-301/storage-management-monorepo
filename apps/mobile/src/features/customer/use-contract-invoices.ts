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

/** What was loaded, and for which contract. */
type Loaded = ContractInvoicesState & { contractId: string | null };

const EMPTY: Loaded = { contractId: null, invoices: [], isLoading: false, error: null };

/** Invoices of one contract, loaded on focus and on `reload`; null `contractId` loads nothing. */
export function useContractInvoices(contractId: string | null) {
  const [state, setState] = useState<Loaded>(EMPTY);
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!contractId) return;
      const controller = new AbortController();
      // A different contract starts empty: its predecessor's QR codes must never show for it.
      setState((current) =>
        current.contractId === contractId
          ? { ...current, isLoading: true, error: null }
          : { contractId, invoices: [], isLoading: true, error: null },
      );
      InvoicesApi.listForContract(contractId, controller.signal)
        .then((invoices) => {
          if (controller.signal.aborted) return;
          setState({ contractId, invoices, isLoading: false, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            error instanceof ApiError ? error.message : 'Không tải được hoá đơn. Vui lòng thử lại.';
          setState((current) => ({ ...current, contractId, isLoading: false, error: message }));
        });
      return () => controller.abort();
    }, [contractId, reloadToken]),
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  // Also guards the render between a contract change and the effect that resets the state.
  const own = contractId !== null && state.contractId === contractId ? state : EMPTY;
  return { invoices: own.invoices, isLoading: own.isLoading, error: own.error, reload };
}
