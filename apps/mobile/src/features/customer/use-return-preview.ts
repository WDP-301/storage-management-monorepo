import { useEffect, useState } from 'react';
import { ContractsApi } from '../../../lib/contracts-api';
import type { ReturnPreviewRecord } from '../../types/contract-api';
import { returnErrorMessage } from './return-errors';

type PreviewState = {
  preview: ReturnPreviewRecord | null;
  isLoading: boolean;
  error: string | null;
};

const IDLE: PreviewState = { preview: null, isLoading: false, error: null };

/**
 * What returning on `dayIso` would cost, fetched again whenever the day changes; the previous
 * request is aborted so a slow answer for an old day never replaces the current one.
 */
export function useReturnPreview(contractId: string, dayIso: string | null): PreviewState {
  const [state, setState] = useState<PreviewState>(IDLE);

  useEffect(() => {
    if (!dayIso) {
      setState(IDLE);
      return;
    }
    const controller = new AbortController();
    setState({ preview: null, isLoading: true, error: null });
    ContractsApi.returnPreview(contractId, dayIso, controller.signal)
      .then((preview) => {
        if (!controller.signal.aborted) setState({ preview, isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          preview: null,
          isLoading: false,
          error: returnErrorMessage(
            error,
            'Không xem trước được chi phí trả kho. Vui lòng thử lại.',
          ),
        });
      });
    return () => controller.abort();
  }, [contractId, dayIso]);

  return state;
}
