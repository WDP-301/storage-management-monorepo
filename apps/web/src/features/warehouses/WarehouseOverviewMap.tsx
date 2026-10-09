import { Badge, Button, LayerCard, Text } from '@cloudflare/kumo';
import { PencilSimple, X } from '@phosphor-icons/react';
import type { Marker } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Warehouse } from '../../types/warehouse';
import { GOONG_STYLE_URL, hasValidCoordinates, toLngLat, warehouseBounds } from './goong-map';
import { useGoongMap } from './useGoongMap';
import { WAREHOUSE_STATUS_LABEL } from './warehouse-display';

type MarkerClass = typeof import('maplibre-gl').Marker;

interface Props {
  warehouses: Warehouse[];
  page: number;
  /** Kept mounted while hidden so switching views does not reload the map. */
  visible: boolean;
  focusedWarehouseId: string | null;
  onEdit: (warehouse: Warehouse) => void;
}

export function WarehouseOverviewMap({
  warehouses,
  page,
  visible,
  focusedWarehouseId,
  onEdit,
}: Props) {
  const { containerRef, map, error } = useGoongMap();
  const [MapMarker, setMapMarker] = useState<MarkerClass | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusedWarehouseId);
  const markers = useRef(new Map<string, Marker>());
  const selectedIdRef = useRef(selectedId);
  const previousSelectedId = useRef(selectedId);
  const selected = warehouses.find((warehouse) => warehouse.id === selectedId);
  const plottable = useMemo(() => warehouses.filter(hasValidCoordinates), [warehouses]);

  useEffect(() => {
    if (!map) return;
    import('maplibre-gl').then(({ Marker }) => setMapMarker(() => Marker));
  }, [map]);

  // The default pin's colour is fixed at creation, so a selection change replaces that marker.
  const placeMarker = useCallback(
    (warehouse: Warehouse, isSelected: boolean) => {
      if (!map || !MapMarker) return;
      markers.current.get(warehouse.id)?.remove();
      const marker = new MapMarker({ color: isSelected ? '#f48120' : '#2658b8' });
      const element = marker.getElement();
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', `Xem kho ${warehouse.code} trên bản đồ`);
      element.setAttribute('aria-pressed', String(isSelected));
      element.addEventListener('click', () => setSelectedId(warehouse.id));
      element.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setSelectedId(warehouse.id);
      });
      marker.setLngLat(toLngLat(warehouse)).addTo(map);
      markers.current.set(warehouse.id, marker);
    },
    [map, MapMarker],
  );

  useEffect(() => {
    const placed = markers.current;
    for (const warehouse of plottable) {
      placeMarker(warehouse, warehouse.id === selectedIdRef.current);
    }
    return () => {
      for (const marker of placed.values()) marker.remove();
      placed.clear();
    };
  }, [plottable, placeMarker]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    const previous = previousSelectedId.current;
    previousSelectedId.current = selectedId;
    if (previous === selectedId) return;
    for (const warehouse of plottable) {
      if (warehouse.id === previous || warehouse.id === selectedId) {
        placeMarker(warehouse, warehouse.id === selectedId);
      }
    }
  }, [selectedId, plottable, placeMarker]);

  useEffect(() => {
    setSelectedId(focusedWarehouseId);
  }, [focusedWarehouseId]);

  useEffect(() => {
    if (selectedId && !warehouses.some((warehouse) => warehouse.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, warehouses]);

  // A selected warehouse owns the camera, so a refetch (e.g. after saving it) does not pull the
  // view back out to the whole page.
  useEffect(() => {
    if (!map || !visible) return;
    map.resize();
    const keptId = selectedIdRef.current;
    if (keptId && warehouses.some((warehouse) => warehouse.id === keptId)) return;
    const bounds = warehouseBounds(warehouses);
    if (bounds) map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 });
  }, [map, visible, warehouses]);

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
          {plottable.length}/{warehouses.length} kho có tọa độ · trang {page}
        </Text>
      </div>
      {notice ? (
        <div role="alert" className="px-5 pb-5 text-kumo-danger">
          {notice}
        </div>
      ) : (
        <div className="relative h-[440px] w-full">
          <section ref={containerRef} aria-label="Bản đồ vị trí kho" className="h-full w-full" />
          {plottable.length === 0 && (
            <div className="absolute bottom-3 left-3 rounded-md bg-kumo-base px-3 py-2 ring ring-kumo-line">
              Không có kho có tọa độ hợp lệ trong trang này.
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
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<PencilSimple className="h-3.5 w-3.5" />}
                  onClick={() => onEdit(selected)}
                >
                  Sửa kho
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </LayerCard>
  );
}
