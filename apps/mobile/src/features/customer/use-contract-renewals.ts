import type { ContractRenewalView } from '@storage/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { ContractRenewalsApi } from '../../../lib/contract-renewals-api';

/**
 * The customer's renewal requests, loaded on focus, on `reload` and when the app returns to the
 * foreground — the branch decides on the web, and the customer also gets a notification.
 * A failed load keeps the last list: the card is informative, the server re-checks every request.
 */
export function useContractRenewals(enabled: boolean) {
  const [renewals, setRenewals] = useState<ContractRenewalView[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const controller = new AbortController();
      const load = () => {
        ContractRenewalsApi.listMine(controller.signal)
          .then((rows) => {
            if (!controller.signal.aborted) setRenewals(rows);
          })
          .catch(() => undefined);
      };
      load();
      const appState = AppState.addEventListener('change', (status) => {
        if (status === 'active') load();
      });
      return () => {
        appState.remove();
        controller.abort();
      };
    }, [enabled, reloadToken]),
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return { renewals, reload };
}
