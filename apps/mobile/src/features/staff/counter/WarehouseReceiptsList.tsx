import type { ShelfReceiptView } from '@storage/types';
import { useFocusEffect } from 'expo-router';
import { Button } from 'heroui-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { linesSummary, receiptTypeLabel } from '../../../../lib/shelf-storage-format';
import { StatusPill } from '../../customer/contract-display';
import { shelfApiError } from '../staff-errors';
import { ListState } from './ListState';

const PAGE_SIZE = 20;

/** Receipts of the warehouse, newest first, searchable by code, customer name or phone. */
export function WarehouseReceiptsList({
  warehouseId,
  onOpen,
}: {
  warehouseId: string;
  onOpen: (receiptId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [receipts, setReceipts] = useState<ShelfReceiptView[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  // Typing waits a moment so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (nextPage: number) => {
      const call = ++latest.current;
      setLoading(true);
      setError(null);
      try {
        const result = await ShelfStorageApi.warehouseReceipts(
          warehouseId,
          nextPage,
          PAGE_SIZE,
          query,
        );
        if (call !== latest.current) return;
        setReceipts((prev) => (nextPage === 1 ? result.receipts : [...prev, ...result.receipts]));
        setPage(result.meta.page);
        setHasMore(result.meta.page < result.meta.totalPages);
      } catch (cause) {
        if (call === latest.current)
          setError(shelfApiError(cause, 'Không tải được danh sách phiếu.'));
      } finally {
        if (call === latest.current) setLoading(false);
      }
    },
    [warehouseId, query],
  );

  // Also reloads when coming back from a receipt, which may have been voided meanwhile.
  useFocusEffect(
    useCallback(() => {
      void load(1);
    }, [load]),
  );

  return (
    <View className="gap-3">
      <TextInput
        accessibilityLabel="Tìm phiếu"
        autoCapitalize="none"
        className="rounded-xl border border-border bg-surface px-3 py-3 font-body text-body-sm text-foreground"
        placeholder="Tìm theo mã phiếu, tên hoặc số điện thoại khách"
        value={search}
        onChangeText={setSearch}
      />
      <ListState
        loading={loading}
        error={error}
        empty={receipts.length === 0}
        emptyText="Chưa có phiếu nào."
        onRetry={() => void load(1)}
      />
      {receipts.map((receipt) => (
        <Pressable
          key={receipt.id}
          accessibilityRole="button"
          className="gap-1 rounded-xl border border-border bg-surface p-3"
          onPress={() => onOpen(receipt.id)}
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-strong text-body-sm text-foreground">{receipt.code}</Text>
            <StatusPill
              label={receipt.status === 'VOIDED' ? 'Đã hủy' : receiptTypeLabel(receipt.type)}
              tone={
                receipt.status === 'VOIDED'
                  ? 'neutral'
                  : receipt.type === 'DROP_OFF'
                    ? 'accent'
                    : 'success'
              }
            />
          </View>
          <Text className="font-body text-body-sm text-foreground" numberOfLines={1}>
            {receipt.customer.fullName ?? receipt.customer.phone ?? '—'} ·{' '}
            {linesSummary(receipt.lines, 2)}
          </Text>
          <Text className="font-body text-caption text-muted">
            Kệ {receipt.shelf.code} · {formatIsoDateTime(String(receipt.createdAt))}
          </Text>
        </Pressable>
      ))}
      {hasMore && !error ? (
        <Button variant="secondary" isDisabled={loading} onPress={() => void load(page + 1)}>
          <Button.Label>{loading ? 'Đang tải…' : 'Xem thêm'}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
