import type { PickupRequestView, ShelfContractStorageView, ShelfReceiptView } from '@storage/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { ShelfStorageApi } from '../../../lib/shelf-storage-api';

const RECEIPT_PAGE_SIZE = 10;

type Loaded = {
  storage: ShelfContractStorageView;
  receipts: ShelfReceiptView[];
  hasMore: boolean;
  requests: PickupRequestView[];
};

const message = (cause: unknown, fallback: string) =>
  cause instanceof ApiError ? cause.message : fallback;

/**
 * Stock, receipt history and pick-up requests of one shelf contract. Reloads on focus and whenever
 * `refreshKey` changes (the parent hands over a new contract object after its own refresh).
 */
export function useShelfStorage(contractId: string, refreshKey: unknown) {
  const [data, setData] = useState<Loaded | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const pageRef = useRef(1);
  // Guards against a slow answer for an earlier load overwriting a newer one.
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [storage, receiptPage, requests] = await Promise.all([
        ShelfStorageApi.contractStorage(contractId),
        ShelfStorageApi.contractReceipts(contractId, 1, RECEIPT_PAGE_SIZE),
        ShelfStorageApi.contractPickupRequests(contractId),
      ]);
      if (loadId !== loadIdRef.current) return;
      pageRef.current = 1;
      setData({
        storage,
        receipts: receiptPage.receipts,
        hasMore: receiptPage.meta.page < receiptPage.meta.totalPages,
        requests,
      });
    } catch (cause) {
      if (loadId !== loadIdRef.current) return;
      setError(message(cause, 'Không tải được đồ đang gửi. Vui lòng thử lại.'));
    } finally {
      if (loadId === loadIdRef.current) setIsLoading(false);
    }
  }, [contractId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // refreshKey and reloadToken are triggers, not inputs.
    }, [load, refreshKey, reloadToken]),
  );
  useEffect(() => () => void loadIdRef.current++, []);

  const loadMore = useCallback(async () => {
    if (!data?.hasMore || isLoadingMore) return;
    const next = pageRef.current + 1;
    setIsLoadingMore(true);
    try {
      const page = await ShelfStorageApi.contractReceipts(contractId, next, RECEIPT_PAGE_SIZE);
      pageRef.current = next;
      setData((current) => {
        if (!current) return current;
        const known = new Set(current.receipts.map((receipt) => receipt.id));
        return {
          ...current,
          receipts: [...current.receipts, ...page.receipts.filter((r) => !known.has(r.id))],
          hasMore: page.meta.page < page.meta.totalPages,
        };
      });
    } catch (cause) {
      setError(message(cause, 'Không tải thêm được phiếu.'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [contractId, data?.hasMore, isLoadingMore]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, isLoading, isLoadingMore, error, loadMore, reload };
}
