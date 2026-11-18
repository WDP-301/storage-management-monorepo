import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '../../../lib/api';
import { InvoicesApi } from '../../../lib/invoices-api';
import { hasUnpaidInvoice } from '../../../lib/settlement-format';
import type { ApiInvoice } from '../../types/invoice-api';

/** Same cadence as the unit-change poll; settlement lands via the SePay webhook, not the app. */
const POLL_MS = 15_000;

export type ContractInvoicesState = {
  invoices: ApiInvoice[];
  isLoading: boolean;
  error: string | null;
};

/** What was loaded, and for which contract. */
type Loaded = ContractInvoicesState & { contractId: string | null };

const EMPTY: Loaded = { contractId: null, invoices: [], isLoading: false, error: null };
const LOAD_FAILED = 'Không tải được hoá đơn. Vui lòng thử lại.';

/**
 * Invoices of one contract, loaded on focus, on `reload`, when the app returns to the foreground,
 * and every `POLL_MS` while an invoice is still owed — a paid QR must drop off on its own.
 */
export function useContractInvoices(contractId: string | null) {
  const [state, setState] = useState<Loaded>(EMPTY);
  const [reloadToken, setReloadToken] = useState(0);

  // Also guards the interval below: rows of another contract never drive this contract's poll.
  const own = contractId !== null && state.contractId === contractId ? state : EMPTY;
  const hasDue = hasUnpaidInvoice(own.invoices);

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

      const load = () => {
        InvoicesApi.listForContract(contractId, controller.signal)
          .then((invoices) => {
            if (controller.signal.aborted) return;
            setState({ contractId, invoices, isLoading: false, error: null });
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            const message = error instanceof ApiError ? error.message : LOAD_FAILED;
            // A failed background poll keeps showing the stale rows instead of flashing
            // a banner over them every interval; only surface errors with nothing to show.
            setState((current) => ({
              ...current,
              contractId,
              isLoading: false,
              error: current.invoices.length === 0 ? message : current.error,
            }));
          });
      };

      load();
      const timer = hasDue ? setInterval(load, POLL_MS) : null;
      return () => {
        if (timer !== null) clearInterval(timer);
        controller.abort();
      };
    }, [contractId, reloadToken, hasDue]),
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  // Customers pay in their banking app and come back: reload so a settled invoice drops its QR.
  useEffect(() => {
    if (!contractId) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') reload();
    });
    return () => subscription.remove();
  }, [contractId, reload]);
  return { invoices: own.invoices, isLoading: own.isLoading, error: own.error, reload };
}
