import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import type { UnitChangeOption } from '../../../lib/change-requests-api';
import { formatMoney } from '../../../lib/format-vi';
import {
  groupShelfOptions,
  type ShelfOptionGroup,
  signedDifference,
} from '../../../lib/shelf-change';
import { WarehousesApi } from '../../../lib/warehouses-api';
import { colors, InlineMessage, type StatusTone, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import type { Warehouse } from '../../types/storage-api';
import { ChipButton } from './FilterChips';
import {
  findPlanShelf,
  type LegendItem,
  ShelfDetailCard,
  ShelfFloorPlan,
  useShelfPlan,
} from './ShelfFloorPlan';
import { shelfStatusLabel } from './shelf-display';
import { OptionDepositNote, UnitChangeOptionRow } from './UnitChangeOptionRow';

const CHANGE_LEGEND: readonly LegendItem[] = [
  ['bg-success-0 border-success-600', 'Chọn được'],
  ['bg-action-primary border-border-selected', 'Đã chọn'],
  ['bg-warning-0 border-warning-600', 'Kệ hiện tại'],
  ['bg-bg-subtle border-border-strong', 'Không khả dụng'],
];

type Loaded = { groups: ShelfOptionGroup<Warehouse>[]; orphans: UnitChangeOption[] };

/**
 * Destination picker of a shelf-change request: the shelf warehouses holding a destination, then
 * the floor plan of the chosen one. Only shelves among `options` (the server's eligible list) can
 * be picked; one at a time, tapping it again clears the choice.
 */
export function ShelfChangePicker({
  contract,
  options,
  selectedId,
  onSelect,
}: {
  contract: ApiContract;
  options: UnitChangeOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const currentWarehouseId = contract.unit?.parent?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);

  // The options carry no building, so find which shelf warehouse of each branch holds them.
  useEffect(() => {
    const controller = new AbortController();
    const facilityIds = [...new Set(options.map((option) => option.unit.facility_id))];
    setLoaded(null);
    setLoadError(null);
    Promise.all(facilityIds.map((id) => WarehousesApi.shelfWarehouses(id, controller.signal)))
      .then((perFacility) =>
        Promise.all(
          perFacility.flat().map(async (warehouse) => ({
            warehouse,
            shelfIds: (await WarehousesApi.shelves(warehouse.id, controller.signal)).map(
              (shelf) => shelf.id,
            ),
          })),
        ),
      )
      .then((contents) => {
        if (controller.signal.aborted) return;
        const result = groupShelfOptions(contents, options, currentWarehouseId);
        setLoaded(result);
        setWarehouseId((current) =>
          current && result.groups.some((group) => group.warehouse.id === current)
            ? current
            : (result.groups[0]?.warehouse.id ?? null),
        );
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(cause instanceof ApiError ? cause.message : 'Không tải được sơ đồ kệ.');
        // Still let the customer pick from the plain list.
        setLoaded({ groups: [], orphans: options });
      });
    return () => controller.abort();
  }, [options, currentWarehouseId]);

  if (!loaded) return <ActivityIndicator color={colors.semantic.actionPrimary} />;

  const group = loaded.groups.find((item) => item.warehouse.id === warehouseId) ?? null;
  const selectedOption = options.find((option) => option.unit.id === selectedId) ?? null;
  const selectedElsewhere =
    selectedOption !== null && !group?.optionIds.includes(selectedOption.unit.id);

  return (
    <View className="gap-3.5">
      {loadError ? <InlineMessage message={loadError} type="warning" /> : null}

      {loaded.groups.length > 1 ? (
        <View className="gap-2">
          <Text className="text-caption text-text-secondary">Chọn kho kệ để xem sơ đồ</Text>
          <View className="flex-row flex-wrap gap-2">
            {loaded.groups.map((item) => (
              <ChipButton
                key={item.warehouse.id}
                label={`${item.warehouse.name}${
                  item.warehouse.id === currentWarehouseId ? ' (hiện tại)' : ''
                } · ${item.optionIds.length}`}
                isSelected={item.warehouse.id === warehouseId}
                onPress={() => setWarehouseId(item.warehouse.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {selectedOption && selectedElsewhere ? (
        <View className="gap-1.5">
          <Text className="text-caption text-text-secondary">Kệ đã chọn</Text>
          <UnitChangeOptionRow option={selectedOption} isSelected onPress={() => onSelect(null)} />
        </View>
      ) : null}

      {group ? (
        <ShelfChangeMap
          key={group.warehouse.id}
          warehouse={group.warehouse}
          eligibleIds={group.optionIds}
          options={options}
          currentId={contract.unit?.id ?? null}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}

      {loaded.orphans.length > 0 ? (
        <View className="gap-2">
          <Text className="text-body-sm font-semibold text-text-primary">
            {loaded.groups.length > 0 ? 'Kệ khác chưa có sơ đồ' : 'Kệ có thể chuyển tới'}
          </Text>
          {loaded.orphans.map((option) => (
            <UnitChangeOptionRow
              key={option.unit.id}
              option={option}
              isSelected={option.unit.id === selectedId}
              onPress={() => onSelect(option.unit.id === selectedId ? null : option.unit.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The floor plan of one shelf warehouse with the shelf-change selection rules. */
function ShelfChangeMap({
  warehouse,
  eligibleIds,
  options,
  currentId,
  selectedId,
  onSelect,
}: {
  warehouse: Warehouse;
  eligibleIds: readonly string[];
  options: UnitChangeOption[];
  currentId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const plan = useShelfPlan(warehouse.id);
  const [focusedId, setFocusedId] = useState<string | null>(selectedId);
  const eligible = useMemo(() => new Set(eligibleIds), [eligibleIds]);
  const isAvailable = (shelf: Warehouse) => eligible.has(shelf.id);

  const focused = focusedId ? findPlanShelf(plan, focusedId) : null;
  const focusedOption = focused ? options.find((option) => option.unit.id === focused.id) : null;

  const handlePress = (shelf: Warehouse) => {
    if (shelf.id === selectedId) {
      onSelect(null);
      setFocusedId(null);
      return;
    }
    if (eligible.has(shelf.id)) {
      onSelect(shelf.id);
      setFocusedId(shelf.id);
      return;
    }
    // Not a destination: tapping only shows (or hides) its details.
    setFocusedId((current) => (current === shelf.id ? null : shelf.id));
  };

  const pill = (shelf: Warehouse): { label: string; tone: StatusTone } => {
    if (shelf.id === selectedId) return { label: 'Đã chọn', tone: 'info' };
    if (shelf.id === currentId) return { label: 'Kệ hiện tại', tone: 'warning' };
    if (eligible.has(shelf.id)) return { label: 'Chọn được', tone: 'success' };
    return {
      label:
        shelf.status === 'AVAILABLE'
          ? 'Không khả dụng'
          : (shelfStatusLabel[shelf.status] ?? shelf.status),
      tone: 'neutral',
    };
  };

  return (
    <View className="gap-3.5">
      <ShelfFloorPlan
        plan={plan}
        warehouseCode={warehouse.code}
        selectedIds={selectedId ? [selectedId] : []}
        focusedId={focusedId}
        onShelfPress={handlePress}
        hint="Chạm để chọn kệ mới"
        isAvailable={isAvailable}
        currentId={currentId}
        legend={CHANGE_LEGEND}
      />

      {focused ? (
        <ShelfDetailCard shelf={focused} warehouseCode={warehouse.code} pill={pill(focused)}>
          {focusedOption ? (
            <View className="gap-0.5">
              <Text className="text-caption text-text-secondary">So với kệ hiện tại</Text>
              <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
                {focusedOption.rent_difference === 0
                  ? 'Giá thuê không đổi'
                  : `${signedDifference(focusedOption.rent_difference, formatMoney)}/tháng`}
              </Text>
              <OptionDepositNote option={focusedOption} />
            </View>
          ) : null}
          {focused.id === selectedId ? (
            <InlineMessage
              message="Đây là kệ bạn muốn chuyển tới. Chạm lại kệ để bỏ chọn."
              type="info"
            />
          ) : focused.id === currentId ? (
            <InlineMessage message="Đây là kệ bạn đang thuê." type="info" />
          ) : !eligible.has(focused.id) ? (
            <InlineMessage message="Kệ này hiện không thể chọn để chuyển tới." type="warning" />
          ) : null}
        </ShelfDetailCard>
      ) : null}
    </View>
  );
}
