import { Badge, Button, LayerCard, Text } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Warehouse } from '../../types/warehouse';
import { GOONG_STYLE_URL, hasValidCoordinates, toLngLat, warehouseBounds } from './goong-map';
import { useGoongMap } from './useGoongMap';
import { useWarehouseClusterMarkers } from './useWarehouseClusterMarkers';
import { WarehouseMapLegend } from './WarehouseMapLegend';
import { WAREHOUSE_STATUS_LABEL } from './warehouse-display';

type MarkerClass = typeof import('maplibre-gl').Marker;

interface Props {
  warehouses: Warehouse[];
  /** While a reload is in flight the list may be empty; keep the selection and camera. */
  isLoading?: boolean;
  /** Kept mounted while hidden so switching views does not reload the map. */
  visible: boolean;
  focusedWarehouseId: string | null;
  /** Role-specific actions shown in the selected warehouse's card. */
  renderActions: (warehouse: Warehouse) => ReactNode;
}

export function WarehouseOverviewMap({
  warehouses,
  isLoading = false,
  visible,
  focusedWarehouseId,
  renderActions,
}: Props) {
  const { containerRef, map, error } = useGoongMap();
  const [MapMarker, setMapMarker] = useState<MarkerClass | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusedWarehouseId);
  const selectedIdRef = useRef(selectedId);
  const selected = warehouses.find((warehouse) => warehouse.id === selectedId);
  const plottable = useMemo(() => warehouses.filter(hasValidCoordinates), [warehouses]);

  useEffect(() => {
    if (!map) return;
    import('maplibre-gl').then(({ Marker }) => setMapMarker(() => Marker));
  }, [map]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useWarehouseClusterMarkers({
    map,
    MapMarker,
    warehouses: plottable,
    selectedId,
    onSelect: setSelectedId,
  });

  useEffect(() => {
    setSelectedId(focusedWarehouseId);
  }, [focusedWarehouseId]);

  useEffect(() => {
    if (isLoading) return;
    if (selectedId && !warehouses.some((warehouse) => warehouse.id === selectedId)) {
      setSelectedId(null);
    }
  }, [isLoading, selectedId, warehouses]);

  // A selected warehouse owns the camera, so a refetch (e.g. after saving it) does not pull the
  // view back out to every warehouse.
  useEffect(() => {
    if (!map || !visible || isLoading) return;
    map.resize();
    const keptId = selectedIdRef.current;
    if (keptId && warehouses.some((warehouse) => warehouse.id === keptId)) return;
    const bounds = warehouseBounds(warehouses);
    if (bounds) map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 });
  }, [map, visible, isLoading, warehouses]);

  const selectedLat = selected?.latitude;
  const selectedLng = selected?.longitude;
  useEffect(() => {
    if (!map || !visible || selectedLat === undefined || selectedLng === undefined) return;
    const point = { latitude: selectedLat, longitude: selectedLng };
    if (!hasValidCoordinates(point)) return;
    map.flyTo({ center: toLngLat(point), zoom: 15, essential: true });
  }, [map, visible, selectedId, selectedLat, selectedLng]);

  const notice = !GOONG_STYLE_URL ? 'Chưa cấu hình VITE_GOONG_MAPTILES_KEY cho web.' : error;

  return (
    <LayerCard className="overflow-hidden p-0 ring ring-kumo-line">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <Text as="h2" variant="heading">
          Bản đồ kho
        </Text>
        <Text variant="secondary">
          {isLoading
            ? 'Đang tải vị trí kho...'
            : `${plottable.length}/${warehouses.length} kho có tọa độ`}
        </Text>
      </div>
      {notice ? (
        <div role="alert" className="px-5 pb-5 text-kumo-danger">
          {notice}
        </div>
      ) : (
        <div className="relative h-[440px] w-full">
          <section ref={containerRef} aria-label="Bản đồ vị trí kho" className="h-full w-full" />
          {plottable.length > 0 && <WarehouseMapLegend warehouses={plottable} />}
          {!isLoading && plottable.length === 0 && (
            <div className="absolute bottom-3 left-3 rounded-md bg-kumo-base px-3 py-2 ring ring-kumo-line">
              Không có kho nào có tọa độ hợp lệ.
            </div>
          )}
          {selected && (
            <div className="absolute bottom-3 left-3 right-3 max-w-sm rounded-lg bg-kumo-base px-4 py-3 shadow-md ring ring-kumo-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Text as="h3" variant="heading">
                    {selected.name}
                  </Text>
                  <Text variant="secondary">
                    {selected.code} · {selected.facility.name}
                  </Text>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  shape="square"
                  icon={<X className="h-4 w-4" />}
                  aria-label="Đóng thông tin kho"
                  onClick={() => setSelectedId(null)}
                />
              </div>
              <p className="mt-2 text-kumo-subtle">{selected.addressLine}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant={WAREHOUSE_STATUS_LABEL[selected.status].variant}>
                  {WAREHOUSE_STATUS_LABEL[selected.status].label}
                </Badge>
                {/* Actions wait for a reload so they never act on a stale copy. */}
                {!isLoading && renderActions(selected)}
              </div>
            </div>
          )}
        </div>
      )}
    </LayerCard>
  );
}
