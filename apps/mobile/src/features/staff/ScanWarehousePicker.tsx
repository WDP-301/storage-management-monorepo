import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { type ScanWarehouse, ShelfStorageApi } from '../../../lib/shelf-storage-api';
import { Button, colors, InlineMessage, TabChip, Text } from '../../components/ui';

// Kept for the app session so staff switching tabs do not pick the warehouse again.
let lastWarehouseId: string | null = null;

/** Chooses the shelf warehouse being entered; a single assigned warehouse is picked for the user. */
export function ScanWarehousePicker({
  value,
  onChange,
}: {
  value: ScanWarehouse | null;
  onChange: (warehouse: ScanWarehouse) => void;
}) {
  const [warehouses, setWarehouses] = useState<ScanWarehouse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = useCallback(
    (warehouse: ScanWarehouse) => {
      lastWarehouseId = warehouse.id;
      onChange(warehouse);
    },
    [onChange],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await ShelfStorageApi.scanWarehouses();
      setWarehouses(list);
      const remembered = list.find((warehouse) => warehouse.id === lastWarehouseId);
      const preset = remembered ?? (list.length === 1 ? list[0] : undefined);
      if (preset) choose(preset);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không tải được danh sách kho.');
    }
  }, [choose]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <View className="gap-3 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
        <InlineMessage message={error} type="error" />
        <Button label="Thử lại" onPress={() => void load()} size="sm" variant="secondary" />
      </View>
    );
  }
  if (!warehouses) {
    return <ActivityIndicator className="py-2" color={colors.semantic.actionPrimary} />;
  }
  if (warehouses.length === 0) {
    return (
      <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
        <InlineMessage message="Bạn chưa được phân công tại kho kệ nào." type="info" />
      </View>
    );
  }
  return (
    <View className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-caption font-semibold text-text-secondary">Kho đang phục vụ</Text>
      <ScrollView
        contentContainerStyle={{ gap: 8 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {warehouses.map((warehouse) => (
          <TabChip
            key={warehouse.id}
            label={warehouse.name}
            onPress={() => choose(warehouse)}
            selected={value?.id === warehouse.id}
            tone="primary"
          />
        ))}
      </ScrollView>
    </View>
  );
}
