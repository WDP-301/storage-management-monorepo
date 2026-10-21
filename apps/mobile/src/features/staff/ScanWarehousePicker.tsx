import { Button } from 'heroui-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { AccessApi, type ScanWarehouse } from '../../../lib/access-api';
import { ApiError } from '../../../lib/api';

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
      const list = await AccessApi.scanWarehouses();
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
      <View className="gap-2 rounded-xl bg-danger-bg p-3">
        <Text className="font-body text-body-sm text-danger">{error}</Text>
        <Button size="sm" variant="secondary" onPress={() => void load()}>
          <Button.Label>Thử lại</Button.Label>
        </Button>
      </View>
    );
  }
  if (!warehouses) return <ActivityIndicator />;
  if (warehouses.length === 0) {
    return (
      <Text className="rounded-xl bg-surface-secondary p-3 font-body text-body-sm text-muted">
        Bạn chưa được phân công tại kho kệ nào.
      </Text>
    );
  }
  return (
    <View className="gap-2">
      <Text className="font-ui text-body-sm text-foreground">Kho đang trực</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {warehouses.map((warehouse) => {
          const selected = value?.id === warehouse.id;
          return (
            <Pressable
              key={warehouse.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`rounded-full px-3.5 py-2.5 ${selected ? 'bg-foreground' : 'bg-surface-secondary'}`}
              onPress={() => choose(warehouse)}
            >
              <Text
                className={`font-ui text-body-sm ${selected ? 'text-background' : 'text-muted'}`}
              >
                {warehouse.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
