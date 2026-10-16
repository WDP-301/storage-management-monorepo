import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'heroui-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../../lib/api';
import { useBrowseSelection } from '../../lib/browse-selection';
import { formatMoney } from '../../lib/format-vi';
import { useHold } from '../../lib/hold';
import { MAX_WAREHOUSES_PER_BOOKING } from '../../lib/warehouse-query';
import { WarehousesApi } from '../../lib/warehouses-api';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ShelfPicker } from '../../src/features/customer/ShelfPicker';
import type { Warehouse } from '../../src/types/storage-api';

export default function ShelvesRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selected, toggle } = useBrowseSelection();
  const { heldBooking, selectWarehouses } = useHold();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setWarehouse(null);
    setError(null);
    setLoading(true);
    if (!id) {
      setError('Không tìm thấy kho kệ.');
      setLoading(false);
      return () => controller.abort();
    }
    WarehousesApi.get(id, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        if (loaded.kind === 'SHELF_WAREHOUSE') setWarehouse(loaded);
        else setError('Kho này không có sơ đồ kệ.');
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof ApiError ? cause.message : 'Không tải được kho kệ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  const selectedIds = selected.map((item) => item.id);
  const totalRent = selected.reduce((sum, item) => sum + item.monthlyPrice, 0);
  const continueBooking = () => {
    if (heldBooking || selected.length === 0) return;
    selectWarehouses(selected);
    router.navigate('/(customer)/schedule');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Chọn kệ" backLabel="Quay lại Tìm kho" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <ActivityIndicator className="mt-12" /> : null}
        {error ? (
          <Text className="mx-4 mt-6 font-body text-body-sm text-danger">{error}</Text>
        ) : null}
        {warehouse ? (
          <View className="gap-4 px-4">
            <View className="gap-1">
              <Text className="font-strong text-title-sm text-foreground">{warehouse.name}</Text>
              <Text className="font-body text-body-sm text-muted">
                {warehouse.facility.name} · {warehouse.addressLine}
              </Text>
            </View>
            <ShelfPicker
              warehouse={warehouse}
              selectedIds={selectedIds}
              selectionFull={selected.length >= MAX_WAREHOUSES_PER_BOOKING}
              hasHolding={Boolean(heldBooking)}
              onToggle={toggle}
              expanded
            />
          </View>
        ) : null}
      </ScrollView>
      {warehouse ? (
        <View className="gap-2 border-t border-border bg-surface px-4 pt-3 pb-2">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-ui text-body-sm text-foreground">
              Đã chọn {selected.length}/{MAX_WAREHOUSES_PER_BOOKING} vị trí
            </Text>
            <Text className="font-numeric text-body-sm text-accent">
              {formatMoney(totalRent)}/tháng
            </Text>
          </View>
          <Button
            isDisabled={Boolean(heldBooking) || selected.length === 0}
            onPress={continueBooking}
          >
            <Button.Label className="font-ui">Tiếp tục đặt lịch</Button.Label>
          </Button>
        </View>
      ) : null}
    </View>
  );
}
