import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useBookingSettings } from '../../../lib/client-settings';
import { InlineMessage } from '../../components/ui';
import type { Warehouse } from '../../types/storage-api';
import { findPlanShelf, ShelfDetailCard, ShelfFloorPlan, useShelfPlan } from './ShelfFloorPlan';
import { shelfStatusLabel as statusLabel } from './shelf-display';

type Props = {
  warehouse: Warehouse;
  selectedIds: readonly string[];
  hasHolding: boolean;
  selectionFull: boolean;
  onToggle: (shelf: Warehouse) => void;
  expanded?: boolean;
};

export function ShelfPicker({
  warehouse,
  selectedIds,
  hasHolding,
  selectionFull,
  onToggle,
  expanded = false,
}: Props) {
  const { maxUnitsPerBooking } = useBookingSettings();
  const plan = useShelfPlan(warehouse.id);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // A reload can drop the focused shelf; forget it then.
  useEffect(() => {
    if (plan.loading) return;
    setFocusedId((current) =>
      current && plan.shelves.some((shelf) => shelf.id === current) ? current : null,
    );
  }, [plan.loading, plan.shelves]);

  const focused = focusedId ? findPlanShelf(plan, focusedId) : null;
  const handleShelfPress = (shelf: Warehouse) => {
    const id = shelf.id;
    const selected = selectedIds.includes(id);
    if (!hasHolding && (selected || (shelf.status === 'AVAILABLE' && !selectionFull))) {
      onToggle(shelf);
      setFocusedId(selected ? null : id);
      return;
    }
    setFocusedId((current) => (current === id ? null : id));
  };

  return (
    <View className="gap-3.5">
      <ShelfFloorPlan
        plan={plan}
        warehouseCode={warehouse.code}
        selectedIds={selectedIds}
        focusedId={focusedId}
        onShelfPress={handleShelfPress}
        hint="Chạm để chọn/bỏ chọn"
        expanded={expanded}
      />

      {focused ? (
        <ShelfDetailCard
          shelf={focused}
          warehouseCode={warehouse.code}
          pill={
            selectedIds.includes(focused.id)
              ? { label: 'Đã chọn', tone: 'info' }
              : {
                  label: statusLabel[focused.status] ?? focused.status,
                  tone: focused.status === 'AVAILABLE' ? 'success' : 'neutral',
                }
          }
        >
          {selectedIds.includes(focused.id) ? (
            <InlineMessage message="Kệ đã được chọn. Chạm lại kệ để bỏ chọn." type="info" />
          ) : null}
          {hasHolding && focused.status === 'AVAILABLE' ? (
            <InlineMessage
              message="Hoàn tất hoặc hủy đơn giữ chỗ hiện tại để chọn thêm kệ."
              type="warning"
            />
          ) : null}
          {selectionFull &&
          !selectedIds.includes(focused.id) &&
          !hasHolding &&
          focused.status === 'AVAILABLE' ? (
            <InlineMessage
              message={`Bạn đã chọn tối đa ${maxUnitsPerBooking} kho hoặc kệ.`}
              type="info"
            />
          ) : null}
        </ShelfDetailCard>
      ) : null}
    </View>
  );
}
