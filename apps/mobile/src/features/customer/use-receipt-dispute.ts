import type { ShelfReceiptView } from '@storage/types';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { receiptBlockedMessage } from '../../../lib/receipt-dispute';
import { ShelfStorageApi } from '../../../lib/shelf-storage-api';

type Loaded = { key: string; receipt: ShelfReceiptView | null; notice: string | null };

/**
 * Loads the receipt a customer is reporting. The key carries the open nonce, so each tap is its own
 * load; a response that arrives after the params changed is dropped instead of overwriting them.
 */
export function useReceiptDispute(receiptId?: string, nonce?: string) {
  const key = receiptId ? `${receiptId}:${nonce ?? ''}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key || !receiptId) {
      setLoaded(null);
      return;
    }
    let stale = false;
    setLoaded(null);
    ShelfStorageApi.getReceipt(receiptId)
      .then((receipt) => {
        if (stale) return;
        const notice = receiptBlockedMessage(receipt);
        setLoaded({ key, receipt: notice ? null : receipt, notice });
      })
      .catch((e: unknown) => {
        if (stale) return;
        setLoaded({
          key,
          receipt: null,
          notice:
            e instanceof ApiError && e.statusCode === 404
              ? 'Không tìm thấy phiếu này.'
              : 'Không tải được phiếu để báo sai. Bạn vẫn có thể tạo yêu cầu thường.',
        });
      });
    return () => {
      stale = true;
    };
  }, [key, receiptId]);

  const current = loaded && loaded.key === key ? loaded : null;
  return { key, receipt: current?.receipt ?? null, notice: current?.notice ?? null };
}
