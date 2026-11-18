import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ApiError } from '../../../lib/api';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { WarehousesApi } from '../../../lib/warehouses-api';
import {
  colors,
  Dashed,
  InlineMessage,
  StatusPill,
  type StatusTone,
  Text,
} from '../../components/ui';
import type { ShelfLayout, Warehouse } from '../../types/storage-api';
import { ShelfUnplacedList } from './ShelfUnplacedList';
import {
  rentableUnplacedShelves,
  shortShelfCode as shortCode,
  shelfStatusLabel as statusLabel,
} from './shelf-display';

/*
 * Shelf floor plan shared by booking (ShelfPicker) and the shelf-change request form: data loading,
 * the zoomable map, the unplaced-shelf list and the detail card. Callers own the selection rules.
 */

const CELL = 52;
const GAP = 5;
const MAX_ZOOM = 3;

/** [swatch classes, label] */
export type LegendItem = readonly [string, string];

export const BOOKING_LEGEND: readonly LegendItem[] = [
  ['bg-success-0 border-success-600', 'Còn trống'],
  ['bg-action-primary border-border-selected', 'Đã chọn'],
  ['bg-bg-subtle border-border-strong', 'Không khả dụng'],
];

export const isShelfAvailable = (shelf: Warehouse) => shelf.status === 'AVAILABLE';

/** Colour key, kept in the map toolbar so it is on screen whenever the plan is. */
export function ShelfLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <View className="flex-1 flex-row flex-wrap gap-x-3 gap-y-1">
      {items.map(([swatch, label]) => (
        <View key={label} className="flex-row items-center gap-1.5">
          <View className={`size-3 rounded border ${swatch}`} />
          <Text className="text-caption text-text-secondary">{label}</Text>
        </View>
      ))}
    </View>
  );
}

export type ShelfPlan = {
  shelves: Warehouse[];
  layout: ShelfLayout | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/** Shelves and floor plan of one shelf warehouse, refetched on `reload()`. */
export function useShelfPlan(warehouseId: string): ShelfPlan {
  const [shelves, setShelves] = useState<Warehouse[]>([]);
  const [layout, setLayout] = useState<ShelfLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      WarehousesApi.shelves(warehouseId, controller.signal),
      WarehousesApi.layout(warehouseId, controller.signal),
    ])
      .then(([shelfList, plan]) => {
        if (controller.signal.aborted) return;
        setShelves(shelfList);
        setLayout(plan);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof ApiError ? cause.message : 'Không tải được sơ đồ kệ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [warehouseId, reloadKey]);

  return { shelves, layout, loading, error, reload: () => setReloadKey((value) => value + 1) };
}

/** Latest data for a shelf of the plan, wherever it appears (shelf list, map or unplaced list). */
export function findPlanShelf(plan: ShelfPlan, id: string): Warehouse | null {
  return (
    plan.shelves.find((shelf) => shelf.id === id) ??
    plan.layout?.placed.find((item) => item.shelf.id === id)?.shelf ??
    plan.layout?.unplaced.find((shelf) => shelf.id === id) ??
    null
  );
}

/** Pinch/zoom floor plan of one shelf warehouse; every tap is resolved in plan coordinates. */
export function ShelfMap({
  grid,
  placed,
  byId,
  warehouseCode,
  selectedIds,
  focusedId,
  onShelfPress,
  expanded,
  isAvailable = isShelfAvailable,
  currentId = null,
  legend = BOOKING_LEGEND,
}: {
  grid: NonNullable<ShelfLayout['layout']>;
  placed: ShelfLayout['placed'];
  byId: Map<string, Warehouse>;
  warehouseCode: string;
  selectedIds: readonly string[];
  focusedId: string | null;
  onShelfPress: (id: string) => void;
  expanded: boolean;
  /** Which shelves can be picked (green); defaults to status AVAILABLE. */
  isAvailable?: (shelf: Warehouse) => boolean;
  /** The customer's own shelf, outlined so they can see where they move from. */
  currentId?: string | null;
  legend?: readonly LegendItem[];
}) {
  const { width, height } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(width - 58);
  const stride = CELL + GAP;
  const contentWidth = grid.cols * stride - GAP;
  const contentHeight = grid.rows * stride - GAP;
  const maxViewportHeight = expanded ? Math.min(680, Math.max(380, height * 0.68)) : 420;
  const fitScale = Math.min(1, viewportWidth / contentWidth, maxViewportHeight / contentHeight);
  const dense = fitScale < 0.72;
  // The frame hugs the fitted plan; a dense plan keeps a taller floor so zooming in has room.
  const viewportHeight = Math.min(
    maxViewportHeight,
    Math.max(dense ? 320 : 220, contentHeight * fitScale + 32),
  );
  // A dense plan opens fitted to the frame so the customer sees every zone first, then taps
  // an area to zoom in. Opening at 100% showed a cropped middle with shelves cut off at the edges.
  const initialScale = fitScale;
  const [overview, setOverview] = useState(false);
  const scale = useSharedValue(initialScale);
  const savedScale = useSharedValue(initialScale);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const pinchDistance = useRef(0);
  const viewportRef = useRef<View>(null);

  useEffect(() => {
    scale.value = initialScale;
    savedScale.value = initialScale;
    offsetX.value = Math.max(0, (contentWidth * initialScale - viewportWidth) / 2);
    offsetY.value = Math.max(0, (contentHeight * initialScale - viewportHeight) / 2);
    setOverview(dense);
  }, [
    initialScale,
    grid.version,
    contentWidth,
    contentHeight,
    viewportWidth,
    viewportHeight,
    scale,
    savedScale,
    offsetX,
    offsetY,
  ]);

  const clampOffsets = (nextScale: number, x: number, y: number) => {
    'worklet';
    const limitX = Math.max(0, (contentWidth * nextScale - viewportWidth) / 2);
    const limitY = Math.max(0, (contentHeight * nextScale - viewportHeight) / 2);
    offsetX.value = Math.min(limitX, Math.max(-limitX, x));
    offsetY.value = Math.min(limitY, Math.max(-limitY, y));
  };

  const touchDistance = (touches: readonly { pageX: number; pageY: number }[]) =>
    Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
  const pan = PanResponder.create({
    // Transformed Pressables can miss taps on Android; handle every map tap in world coordinates.
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: (event, state) =>
      event.nativeEvent.touches.length >= 2 ||
      (!overview &&
        scale.value > fitScale + 0.01 &&
        (Math.abs(state.dx) > 5 || Math.abs(state.dy) > 5)),
    onPanResponderGrant: (event) => {
      savedX.value = offsetX.value;
      savedY.value = offsetY.value;
      savedScale.value = scale.value;
      pinchDistance.current =
        event.nativeEvent.touches.length >= 2 ? touchDistance(event.nativeEvent.touches) : 0;
    },
    onPanResponderMove: (event, state) => {
      if (event.nativeEvent.touches.length >= 2) {
        const distance = touchDistance(event.nativeEvent.touches);
        if (pinchDistance.current === 0) {
          pinchDistance.current = distance;
          savedScale.value = scale.value;
        }
        scale.value = Math.min(
          MAX_ZOOM,
          Math.max(fitScale, (savedScale.value * distance) / pinchDistance.current),
        );
        clampOffsets(scale.value, offsetX.value, offsetY.value);
        if (scale.value > fitScale + 0.01) setOverview(false);
      } else {
        if (!overview) clampOffsets(scale.value, savedX.value + state.dx, savedY.value + state.dy);
      }
    },
    onPanResponderRelease: (event, state) => {
      if (Math.abs(state.dx) < 5 && Math.abs(state.dy) < 5 && pinchDistance.current === 0) {
        const { pageX, pageY } = event.nativeEvent;
        viewportRef.current?.measureInWindow((originX, originY) => {
          // Android pageY includes the status bar, while measureInWindow excludes it.
          const localY =
            pageY - originY - (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);
          const x =
            (pageX - originX - viewportWidth / 2 - offsetX.value) / scale.value + contentWidth / 2;
          const y = (localY - viewportHeight / 2 - offsetY.value) / scale.value + contentHeight / 2;
          if (overview) {
            scale.value = 1;
            savedScale.value = 1;
            clampOffsets(1, contentWidth / 2 - x, contentHeight / 2 - y);
            setOverview(false);
            return;
          }
          const hit = placed.find(
            (item) =>
              x >= item.col * stride &&
              x < (item.col + item.colSpan) * stride - GAP &&
              y >= item.row * stride &&
              y < (item.row + item.rowSpan) * stride - GAP,
          );
          if (hit) onShelfPress(hit.shelf.id);
        });
      }
      pinchDistance.current = 0;
    },
  });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));
  const changeZoom = (factor: number) => {
    scale.value = Math.min(MAX_ZOOM, Math.max(fitScale, scale.value * factor));
    clampOffsets(scale.value, offsetX.value, offsetY.value);
    setOverview(scale.value <= fitScale + 0.01);
  };
  const resetZoom = () => {
    scale.value = fitScale;
    offsetX.value = 0;
    offsetY.value = 0;
    setOverview(dense);
  };

  return (
    <>
      <View className="flex-row items-center justify-between gap-2 border-b border-border-default px-3.5 py-2.5">
        <ShelfLegend items={legend} />
        <View className="flex-row items-center gap-1.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thu nhỏ sơ đồ"
            onPress={() => changeZoom(1 / 1.35)}
            className="size-8 items-center justify-center rounded-full bg-bg-subtle"
          >
            <Text className="text-body-lg font-bold text-text-link">−</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem toàn bộ sơ đồ"
            onPress={resetZoom}
            className="min-h-8 items-center justify-center rounded-full bg-bg-subtle px-2.5"
          >
            <Text className="text-caption font-medium text-text-link">Toàn cảnh</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Phóng to sơ đồ"
            onPress={() => changeZoom(1.35)}
            className="size-8 items-center justify-center rounded-full bg-bg-subtle"
          >
            <Text className="text-body-lg font-bold text-text-link">+</Text>
          </Pressable>
        </View>
      </View>
      <View
        ref={viewportRef}
        className="overflow-hidden bg-bg-card"
        style={{ height: viewportHeight }}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: contentWidth,
              height: contentHeight,
              left: (viewportWidth - contentWidth) / 2,
              top: (viewportHeight - contentHeight) / 2,
            },
            animatedStyle,
          ]}
        >
          {grid.elements.map((element, index) => {
            const bounds = {
              position: 'absolute' as const,
              left: element.col * stride,
              top: element.row * stride,
              width: element.colSpan * stride - GAP,
              height: element.rowSpan * stride - GAP,
            };
            if (element.type === 'AISLE') {
              return (
                <View
                  key={`element-${index}`}
                  style={bounds}
                  className="items-center justify-center border-y border-dashed border-border-default"
                >
                  {element.colSpan > 2 ? (
                    <Text style={{ fontSize: 15 }} className="font-medium text-text-secondary">
                      LỐI ĐI
                    </Text>
                  ) : null}
                </View>
              );
            }
            if (element.type === 'DOOR') {
              return (
                <View
                  key={`element-${index}`}
                  style={bounds}
                  className="items-center justify-center rounded-md bg-secondary-0"
                >
                  <Text
                    style={{ fontSize: 15 }}
                    className="font-medium text-text-link"
                    numberOfLines={1}
                  >
                    Cửa
                  </Text>
                </View>
              );
            }
            if (element.type === 'OBSTACLE') {
              return (
                <View key={`element-${index}`} style={bounds} className="rounded-md bg-bg-subtle" />
              );
            }
            return (
              <View key={`element-${index}`} style={bounds} className="items-center justify-center">
                <Text
                  style={{ fontSize: 14 }}
                  className="text-center font-medium text-text-secondary"
                  numberOfLines={2}
                >
                  {element.text}
                </Text>
              </View>
            );
          })}
          {placed.map((placement) => {
            const shelf = byId.get(placement.shelf.id) ?? placement.shelf;
            const selected = selectedIds.includes(shelf.id);
            const focusedCell = focusedId === shelf.id;
            const available = isAvailable(shelf);
            const current = shelf.id === currentId;
            return (
              <Pressable
                key={shelf.id}
                accessibilityRole="button"
                accessibilityLabel={
                  selected
                    ? `Bỏ chọn kệ ${shelf.code}`
                    : current
                      ? `Kệ ${shelf.code}, kệ hiện tại của bạn`
                      : available
                        ? `Chọn kệ ${shelf.code}`
                        : `Kệ ${shelf.code}, ${shelf.status === 'AVAILABLE' ? 'không khả dụng' : (statusLabel[shelf.status] ?? shelf.status)}`
                }
                accessibilityState={{ selected: focusedCell }}
                onPress={() => onShelfPress(shelf.id)}
                style={{
                  position: 'absolute',
                  top: placement.row * stride,
                  left: placement.col * stride,
                  width: placement.colSpan * stride - GAP,
                  height: placement.rowSpan * stride - GAP,
                }}
                className={`items-center justify-center rounded-lg border-2 px-1 ${
                  selected
                    ? 'border-border-selected bg-action-primary'
                    : focusedCell
                      ? 'border-border-selected bg-secondary-0'
                      : current
                        ? 'border-warning-600 bg-warning-0'
                        : available
                          ? 'border-success-600 bg-success-0'
                          : 'border-border-default bg-bg-subtle'
                }`}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  style={{ fontSize: 16 }}
                  className={`text-center font-semibold tabular-nums ${
                    selected
                      ? 'text-text-inverse'
                      : available || focusedCell || current
                        ? 'text-text-primary'
                        : 'text-text-secondary'
                  }`}
                >
                  {shortCode(shelf.code, warehouseCode)}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
      {/* Sits under the plan instead of over it, so the bottom row of shelves stays visible. */}
      <Text className="border-t border-border-default px-3.5 py-2 text-caption text-text-secondary">
        {overview
          ? 'Chạm vào vùng muốn xem để phóng to'
          : 'Chụm hai ngón để thu phóng · Kéo để xem khi phóng to'}
      </Text>
    </>
  );
}

/**
 * Header, loading/error/empty states, the map and the list of shelves missing from it. Taps are
 * reported with the resolved shelf; the caller decides whether it selects or only focuses it.
 */
export function ShelfFloorPlan({
  plan,
  warehouseCode,
  selectedIds,
  focusedId,
  onShelfPress,
  hint,
  expanded = false,
  isAvailable = isShelfAvailable,
  currentId = null,
  legend = BOOKING_LEGEND,
}: {
  plan: ShelfPlan;
  warehouseCode: string;
  selectedIds: readonly string[];
  focusedId: string | null;
  onShelfPress: (shelf: Warehouse) => void;
  /** Shown after the available count, e.g. "Chạm để chọn/bỏ chọn". */
  hint: string;
  expanded?: boolean;
  isAvailable?: (shelf: Warehouse) => boolean;
  currentId?: string | null;
  legend?: readonly LegendItem[];
}) {
  const { shelves, layout, loading, error } = plan;
  const byId = new Map(shelves.map((shelf) => [shelf.id, shelf]));
  const placed = layout?.placed ?? [];
  // Shelves the admin has not put on the floor plan yet are still rentable; they are listed
  // under the map (or instead of it when there is no plan) so the customer can pick them.
  const unplaced = rentableUnplacedShelves(layout?.unplaced ?? [], byId);
  const availableCount = [
    ...placed.map(({ shelf }) => byId.get(shelf.id) ?? shelf),
    ...unplaced,
  ].filter(isAvailable).length;
  const grid = layout?.layout;
  const hasMap = Boolean(grid) && placed.length > 0;
  const handlePress = (id: string) => {
    const shelf = findPlanShelf(plan, id);
    if (shelf) onShelfPress(shelf);
  };

  return (
    <>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-title-sm font-bold text-text-primary">Sơ đồ kệ</Text>
          <Text className="text-body-sm text-text-secondary tabular-nums">
            {availableCount} kệ trống · {hint}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={plan.reload} hitSlop={8}>
          <Text className="text-body-sm font-semibold text-text-link">Làm mới</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator className="py-8" color={colors.semantic.actionPrimary} />
      ) : null}
      {error ? <InlineMessage message={error} type="error" /> : null}
      {!loading && !error && !hasMap && unplaced.length === 0 ? (
        <View className="rounded-[20px] border border-border-default bg-bg-card px-4 py-6">
          <Text className="text-center text-body-sm text-text-secondary">
            {shelves.length === 0 ? 'Kho này chưa có kệ.' : 'Kho này chưa có sơ đồ kệ.'}
          </Text>
        </View>
      ) : null}

      {!loading && !error && grid && hasMap ? (
        <View className="overflow-hidden rounded-[20px] border border-border-default bg-bg-card">
          <ShelfMap
            grid={grid}
            placed={placed}
            byId={byId}
            warehouseCode={warehouseCode}
            selectedIds={selectedIds}
            focusedId={focusedId}
            onShelfPress={handlePress}
            expanded={expanded}
            isAvailable={isAvailable}
            currentId={currentId}
            legend={legend}
          />
        </View>
      ) : null}

      {!loading && !error && unplaced.length > 0 ? (
        <ShelfUnplacedList
          title={hasMap ? 'Kệ chưa có trên sơ đồ' : 'Danh sách kệ'}
          shelves={unplaced}
          warehouseCode={warehouseCode}
          selectedIds={selectedIds}
          focusedId={focusedId}
          onShelfPress={handlePress}
          isAvailable={isAvailable}
          currentId={currentId}
        />
      ) : null}
    </>
  );
}

/** Code, status, size and price of one shelf; `children` adds caller-specific notes below. */
export function ShelfDetailCard({
  shelf,
  warehouseCode,
  pill,
  children,
}: {
  shelf: Warehouse;
  warehouseCode: string;
  pill: { label: string; tone: StatusTone };
  children?: ReactNode;
}) {
  return (
    <View className="gap-3.5 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-body-lg font-bold text-text-primary">
            Kệ {shortCode(shelf.code, warehouseCode)}
          </Text>
        </View>
        <StatusPill label={pill.label} tone={pill.tone} />
      </View>
      <Dashed />
      <View className="flex-row flex-wrap gap-x-6 gap-y-2">
        <View className="gap-0.5">
          <Text className="text-caption text-text-secondary">Diện tích</Text>
          <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
            {formatNumber(shelf.areaM2)} m²
          </Text>
        </View>
        <View className="gap-0.5">
          <Text className="text-caption text-text-secondary">Kích thước (R × D × C)</Text>
          <Text className="text-body-sm font-semibold text-text-primary tabular-nums">
            {formatNumber(shelf.widthM)} × {formatNumber(shelf.lengthM)} ×{' '}
            {shelf.heightM == null ? '—' : formatNumber(shelf.heightM)} m
          </Text>
        </View>
      </View>
      <Dashed />
      <View className="gap-1">
        <Text className="text-caption text-text-secondary">Giá thuê</Text>
        <Text className="text-subtitle font-bold text-text-brand tabular-nums">
          {formatMoney(shelf.monthlyPrice)}/tháng
        </Text>
        <Text className="text-caption text-text-secondary tabular-nums">
          Cọc {formatMoney(shelf.monthlyPrice * shelf.effectiveDepositMonths)} (
          {shelf.effectiveDepositMonths} tháng)
        </Text>
      </View>
      {children}
    </View>
  );
}
