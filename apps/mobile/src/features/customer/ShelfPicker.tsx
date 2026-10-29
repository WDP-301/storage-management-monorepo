import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ApiError } from '../../../lib/api';
import { useBookingSettings } from '../../../lib/client-settings';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { WarehousesApi } from '../../../lib/warehouses-api';
import type { ShelfLayout, Warehouse } from '../../types/storage-api';
import { ShelfUnplacedList } from './ShelfUnplacedList';
import {
  rentableUnplacedShelves,
  shortShelfCode as shortCode,
  shelfStatusLabel as statusLabel,
} from './shelf-display';

type Props = {
  warehouse: Warehouse;
  selectedIds: readonly string[];
  hasHolding: boolean;
  selectionFull: boolean;
  onToggle: (shelf: Warehouse) => void;
  expanded?: boolean;
};

const CELL = 52;
const GAP = 5;
const MAX_ZOOM = 3;

const LEGEND = [
  ['bg-success-bg border-success', 'Còn trống'],
  ['bg-accent border-accent', 'Đã chọn'],
  ['bg-surface-secondary border-border', 'Không khả dụng'],
] as const;

/** Colour key, kept in the map toolbar so it is on screen whenever the plan is. */
function ShelfLegend() {
  return (
    <View className="flex-1 flex-row flex-wrap gap-x-3 gap-y-1">
      {LEGEND.map(([colors, label]) => (
        <View key={label} className="flex-row items-center gap-1.5">
          <View className={`size-3 rounded border ${colors}`} />
          <Text className="font-body text-caption text-muted">{label}</Text>
        </View>
      ))}
    </View>
  );
}

function ShelfMap({
  grid,
  placed,
  byId,
  warehouseCode,
  selectedIds,
  focusedId,
  onShelfPress,
  expanded,
}: {
  grid: NonNullable<ShelfLayout['layout']>;
  placed: ShelfLayout['placed'];
  byId: Map<string, Warehouse>;
  warehouseCode: string;
  selectedIds: readonly string[];
  focusedId: string | null;
  onShelfPress: (id: string) => void;
  expanded: boolean;
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
      <View className="flex-row items-center justify-between gap-2 border-b border-border px-3 py-2">
        <ShelfLegend />
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thu nhỏ sơ đồ"
            onPress={() => changeZoom(1 / 1.35)}
            className="size-8 items-center justify-center rounded-full bg-surface-secondary"
          >
            <Text className="font-strong text-body-lg text-accent">−</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem toàn bộ sơ đồ"
            onPress={resetZoom}
            className="min-h-8 items-center justify-center rounded-full bg-surface-secondary px-2"
          >
            <Text className="font-ui text-caption text-accent">Toàn cảnh</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Phóng to sơ đồ"
            onPress={() => changeZoom(1.35)}
            className="size-8 items-center justify-center rounded-full bg-surface-secondary"
          >
            <Text className="font-strong text-body-lg text-accent">+</Text>
          </Pressable>
        </View>
      </View>
      <View
        ref={viewportRef}
        className="overflow-hidden bg-surface"
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
                  className="items-center justify-center border-y border-dashed border-border"
                >
                  {element.colSpan > 2 ? (
                    <Text style={{ fontSize: 15 }} className="font-ui text-muted">
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
                  className="items-center justify-center rounded-md bg-accent/10"
                >
                  <Text style={{ fontSize: 15 }} className="font-ui text-accent" numberOfLines={1}>
                    Cửa
                  </Text>
                </View>
              );
            }
            if (element.type === 'OBSTACLE') {
              return (
                <View
                  key={`element-${index}`}
                  style={bounds}
                  className="rounded-md bg-surface-secondary"
                />
              );
            }
            return (
              <View key={`element-${index}`} style={bounds} className="items-center justify-center">
                <Text
                  style={{ fontSize: 14 }}
                  className="text-center font-ui text-muted"
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
            const available = shelf.status === 'AVAILABLE';
            return (
              <Pressable
                key={shelf.id}
                accessibilityRole="button"
                accessibilityLabel={
                  selected
                    ? `Bỏ chọn kệ ${shelf.code}`
                    : available
                      ? `Chọn kệ ${shelf.code}`
                      : `Kệ ${shelf.code}, ${statusLabel[shelf.status] ?? shelf.status}`
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
                    ? 'border-accent bg-accent'
                    : focusedCell
                      ? 'border-accent bg-accent/10'
                      : available
                        ? 'border-success bg-success-bg'
                        : 'border-border bg-surface-secondary'
                }`}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  style={{ fontSize: 16 }}
                  className={`text-center font-numeric ${selected ? 'text-white' : available || focusedCell ? 'text-foreground' : 'text-muted'}`}
                >
                  {shortCode(shelf.code, warehouseCode)}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
      {/* Sits under the plan instead of over it, so the bottom row of shelves stays visible. */}
      <Text className="border-t border-border px-3 py-2 font-body text-caption text-muted">
        {overview
          ? 'Chạm vào vùng muốn xem để phóng to'
          : 'Chụm hai ngón để thu phóng · Kéo để xem khi phóng to'}
      </Text>
    </>
  );
}

export function ShelfPicker({
  warehouse,
  selectedIds,
  hasHolding,
  selectionFull,
  onToggle,
  expanded = false,
}: Props) {
  const { maxUnitsPerBooking } = useBookingSettings();
  const [shelves, setShelves] = useState<Warehouse[]>([]);
  const [layout, setLayout] = useState<ShelfLayout | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      WarehousesApi.shelves(warehouse.id, controller.signal),
      WarehousesApi.layout(warehouse.id, controller.signal),
    ])
      .then(([shelfList, plan]) => {
        if (controller.signal.aborted) return;
        setShelves(shelfList);
        setLayout(plan);
        setFocusedId((current) =>
          current && shelfList.some((shelf) => shelf.id === current) ? current : null,
        );
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof ApiError ? cause.message : 'Không tải được sơ đồ kệ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [warehouse.id, reload]);

  const byId = new Map(shelves.map((shelf) => [shelf.id, shelf]));
  const focused = focusedId ? byId.get(focusedId) : null;
  const placed = layout?.placed ?? [];
  // Shelves the admin has not put on the floor plan yet are still rentable; they are listed
  // under the map (or instead of it when there is no plan) so the customer can pick them.
  const unplaced = rentableUnplacedShelves(layout?.unplaced ?? [], byId);
  const availableCount = [
    ...placed.map(({ shelf }) => byId.get(shelf.id) ?? shelf),
    ...unplaced,
  ].filter((shelf) => shelf.status === 'AVAILABLE').length;
  const grid = layout?.layout;
  const hasMap = Boolean(grid) && placed.length > 0;
  const handleShelfPress = (id: string) => {
    const shelf =
      byId.get(id) ??
      placed.find((item) => item.shelf.id === id)?.shelf ??
      unplaced.find((item) => item.id === id);
    if (!shelf) return;
    const selected = selectedIds.includes(id);
    if (!hasHolding && (selected || (shelf.status === 'AVAILABLE' && !selectionFull))) {
      onToggle(shelf);
      setFocusedId(selected ? null : id);
      return;
    }
    setFocusedId((current) => (current === id ? null : id));
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="font-strong text-title-sm text-foreground">Sơ đồ kệ</Text>
          <Text className="font-body text-body-sm text-muted">
            {availableCount} kệ trống · Chạm để chọn/bỏ chọn
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setReload((value) => value + 1)}
          hitSlop={8}
        >
          <Text className="font-ui text-body-sm text-accent">Làm mới</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator className="py-8" /> : null}
      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      {!loading && !error && !hasMap && unplaced.length === 0 ? (
        <View className="rounded-xl bg-surface-secondary px-4 py-6">
          <Text className="text-center font-body text-body-sm text-muted">
            {shelves.length === 0 ? 'Kho này chưa có kệ.' : 'Kho này chưa có sơ đồ kệ.'}
          </Text>
        </View>
      ) : null}

      {!loading && !error && grid && hasMap ? (
        <View className="overflow-hidden rounded-xl border border-border bg-surface">
          <ShelfMap
            grid={grid}
            placed={placed}
            byId={byId}
            warehouseCode={warehouse.code}
            selectedIds={selectedIds}
            focusedId={focusedId}
            onShelfPress={handleShelfPress}
            expanded={expanded}
          />
        </View>
      ) : null}

      {!loading && !error && unplaced.length > 0 ? (
        <ShelfUnplacedList
          title={hasMap ? 'Kệ chưa có trên sơ đồ' : 'Danh sách kệ'}
          shelves={unplaced}
          warehouseCode={warehouse.code}
          selectedIds={selectedIds}
          focusedId={focusedId}
          onShelfPress={handleShelfPress}
        />
      ) : null}

      {focused ? (
        <View className="gap-3 rounded-xl border border-border bg-surface p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="font-strong text-body-lg text-foreground">
                Kệ {shortCode(focused.code, warehouse.code)}
              </Text>
              <Text className="font-numeric text-caption text-muted">{focused.code}</Text>
            </View>
            <Text
              className={`rounded-full px-2.5 py-1 font-ui text-caption ${selectedIds.includes(focused.id) ? 'bg-accent/10 text-accent' : focused.status === 'AVAILABLE' ? 'bg-success-bg text-success' : 'bg-surface-secondary text-muted'}`}
            >
              {selectedIds.includes(focused.id)
                ? 'Đã chọn'
                : (statusLabel[focused.status] ?? focused.status)}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-x-5 gap-y-2 border-y border-border py-3">
            <View className="gap-0.5">
              <Text className="font-body text-caption text-muted">Diện tích</Text>
              <Text className="font-numeric text-body-sm text-foreground">
                {formatNumber(focused.areaM2)} m²
              </Text>
            </View>
            <View className="gap-0.5">
              <Text className="font-body text-caption text-muted">Kích thước (R × D × C)</Text>
              <Text className="font-numeric text-body-sm text-foreground">
                {formatNumber(focused.widthM)} × {formatNumber(focused.lengthM)} ×{' '}
                {focused.heightM == null ? '—' : formatNumber(focused.heightM)} m
              </Text>
            </View>
          </View>
          <View className="gap-1">
            <Text className="font-body text-caption text-muted">Giá thuê</Text>
            <Text className="font-numeric-strong text-num-lg text-accent">
              {formatMoney(focused.monthlyPrice)}/tháng
            </Text>
            <Text className="font-body text-caption text-muted">
              Cọc {formatMoney(focused.monthlyPrice * focused.effectiveDepositMonths)} (
              {focused.effectiveDepositMonths} tháng)
            </Text>
          </View>
          {selectedIds.includes(focused.id) ? (
            <Text className="font-body text-caption text-accent">
              Kệ đã được chọn. Chạm lại kệ để bỏ chọn.
            </Text>
          ) : null}
          {hasHolding && focused.status === 'AVAILABLE' ? (
            <Text className="font-body text-caption text-warning">
              Hoàn tất hoặc hủy đơn giữ chỗ hiện tại để chọn thêm kệ.
            </Text>
          ) : null}
          {selectionFull &&
          !selectedIds.includes(focused.id) &&
          !hasHolding &&
          focused.status === 'AVAILABLE' ? (
            <Text className="font-body text-caption text-muted">
              Bạn đã chọn tối đa {maxUnitsPerBooking} kho hoặc kệ.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
