import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ApiError } from '../../lib/api';
import { useBrowseSelection } from '../../lib/browse-selection';
import { useBookingSettings } from '../../lib/client-settings';
import { formatMoney } from '../../lib/format-vi';
import { useHold } from '../../lib/hold';
import { WarehousesApi } from '../../lib/warehouses-api';
import { Button, colors, FlowScreen, InlineMessage, PayBar, Text } from '../../src/components/ui';
import { ShelfPicker } from '../../src/features/customer/ShelfPicker';
import type { Warehouse } from '../../src/types/storage-api';

export default function ShelvesRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selected, toggle } = useBrowseSelection();
  const { maxUnitsPerBooking } = useBookingSettings();
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
  const blockedReason = heldBooking
    ? 'Đang có đơn giữ chỗ'
    : selected.length === 0
      ? 'Chọn ít nhất 1 kệ'
      : null;
  const continueBooking = () => {
    if (heldBooking || selected.length === 0) return;
    selectWarehouses(selected);
    router.navigate('/(customer)/schedule');
  };

  return (
    <FlowScreen
      muted
      backLabel="Quay lại Tìm kho"
      title="Chọn kệ"
      titleAlign="left"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(customer)/browse'))}
    >
      <ScrollView
        className="flex-1 bg-bg-muted"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator className="mt-12" color={colors.semantic.actionPrimary} />
        ) : null}
        {error ? (
          <View className="mx-4 mt-4 rounded-[20px] border border-border-default bg-bg-card p-4">
            <InlineMessage message={error} type="error" />
          </View>
        ) : null}
        {warehouse ? (
          <View className="gap-4 p-4">
            <View className="gap-1 rounded-[20px] border border-border-default bg-bg-card p-4">
              <Text className="text-title-sm font-bold text-text-primary">{warehouse.name}</Text>
              <Text className="text-body-sm text-text-secondary">
                {warehouse.facility.name} · {warehouse.addressLine}
              </Text>
            </View>
            <ShelfPicker
              warehouse={warehouse}
              selectedIds={selectedIds}
              selectionFull={selected.length >= maxUnitsPerBooking}
              hasHolding={Boolean(heldBooking)}
              onToggle={toggle}
              expanded
            />
          </View>
        ) : null}
      </ScrollView>
      {warehouse ? (
        <PayBar
          amount={`${formatMoney(totalRent)}/tháng`}
          insetBottom
          label={`Đã chọn ${selected.length}/${maxUnitsPerBooking} vị trí`}
        >
          <Button
            disabled={blockedReason !== null}
            label={blockedReason ?? 'Tiếp tục đặt lịch'}
            rightIcon={blockedReason ? undefined : 'arrow-forward'}
            variant={blockedReason ? 'secondary' : 'primary'}
            onPress={continueBooking}
          />
        </PayBar>
      ) : null}
    </FlowScreen>
  );
}
