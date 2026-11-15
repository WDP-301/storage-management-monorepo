import type { ShelfReceiptView } from '@storage/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatIsoDateTime } from '../../../../lib/format-vi';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { linesSummary, receiptTypeLabel } from '../../../../lib/shelf-storage-format';
import { Button, colors, Icon, Input, Text } from '../../../components/ui';
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
        if (call === latest.current) {
          setError(shelfApiError(cause, 'Không tải được danh sách phiếu.'));
        }
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
      <View className="rounded-[20px] border border-border-default bg-bg-card p-3">
        <Input
          accessibilityLabel="Tìm phiếu"
          autoCapitalize="none"
          clearable
          leftIcon="search"
          onChangeText={setSearch}
          placeholder="Tìm theo mã phiếu, tên hoặc SĐT khách"
          value={search}
        />
      </View>
      <ListState
        empty={receipts.length === 0}
        emptyText="Chưa có phiếu nào."
        error={error}
        loading={loading}
        onRetry={() => void load(1)}
      />
      {receipts.map((receipt) => (
        <Pressable
          key={receipt.id}
          accessibilityRole="button"
          className="gap-1.5 rounded-[20px] border border-border-default bg-bg-card p-4"
          onPress={() => onOpen(receipt.id)}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-body font-semibold text-text-primary">{receipt.code}</Text>
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
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 gap-0.5">
              <Text className="text-body text-text-primary" numberOfLines={1}>
                {receipt.customer.fullName ?? receipt.customer.phone ?? '—'} ·{' '}
                {linesSummary(receipt.lines, 2)}
              </Text>
              <Text className="text-caption text-text-secondary">
                Kệ {receipt.shelf.code} · {formatIsoDateTime(String(receipt.createdAt))}
              </Text>
            </View>
            <Icon color={colors.semantic.textSecondary} name="chevron-right" size={18} />
          </View>
        </Pressable>
      ))}
      {hasMore && !error ? (
        <Button
          disabled={loading}
          fullWidth
          label={loading ? 'Đang tải…' : 'Xem thêm'}
          loading={loading}
          onPress={() => void load(page + 1)}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}
