import type { PickupRequestLineView, ShelfItemView } from '@storage/types';
import { useCallback, useEffect, useState } from 'react';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { shelfApiError } from '../staff-errors';

export type FormSource = {
  items: ShelfItemView[];
  /** The customer's open request lines to prefill a pick-up from. */
  requestLines: PickupRequestLineView[];
  shelfCode: string;
  contractNo: string;
  customerName: string;
};

/**
 * Fresh stock for the form: the counter session for receipts (its contract also says what is
 * blocked), or the contract's own storage for a manager's recovery, which has no session.
 */
export function useReceiptFormSource(params: {
  recovery: boolean;
  sessionId?: string;
  contractId: string;
  requestId?: string;
  customerName?: string;
}) {
  const { recovery, sessionId, contractId, requestId, customerName } = params;
  const [source, setSource] = useState<FormSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (recovery) {
        const storage = await ShelfStorageApi.contractStorage(contractId);
        setSource({
          items: storage.items,
          requestLines: [],
          shelfCode: storage.shelf.code,
          contractNo: storage.contractNo,
          customerName: customerName ?? '',
        });
        return;
      }
      if (!sessionId) throw new Error('missing session');
      const session = await ShelfStorageApi.getSession(sessionId);
      const contract = session.contracts.find((c) => c.contractId === contractId);
      if (!contract) throw new Error('missing contract');
      setSource({
        items: contract.items,
        requestLines:
          requestId && contract.openRequest?.id === requestId ? contract.openRequest.lines : [],
        shelfCode: contract.shelf.code,
        contractNo: contract.contractNo,
        customerName: session.customer.fullName ?? session.customer.phone ?? '',
      });
    } catch (cause) {
      setError(shelfApiError(cause, 'Không tải được thông tin kệ. Quét lại mã của khách.'));
    }
  }, [recovery, sessionId, contractId, requestId, customerName]);

  useEffect(() => {
    void load();
  }, [load]);

  return { source, error, reload: load };
}
