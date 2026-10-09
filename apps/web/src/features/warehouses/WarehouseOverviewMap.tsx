import { Badge, Button, LayerCard, Text } from '@cloudflare/kumo';
import { PencilSimple } from '@phosphor-icons/react';
import type { Marker } from 'maplibre-gl';
import { useEffect, useMemo, useState } from 'react';
import type { Warehouse } from '../../types/warehouse';
import { GOONG_STYLE_URL, hasValidCoordinates, toLngLat, warehouseBounds } from './goong-map';
import { useGoongMap } from './useGoongMap';
import { WAREHOUSE_STATUS_LABEL } from './warehouse-display';

interface Props {
  warehouses: Warehouse[];
  page: number;
  focusedWarehouseId: string | null;
  onEdit: (warehouse: Warehouse) => void;
}

export function WarehouseOverviewMap({ warehouses, page, focusedWarehouseId, onEdit }: Props) {
  const { containerRef, map, error } = useGoongMap();
  const [selectedId, setSelectedId] = useState<string | null>(focusedWarehouseId);
  const selected = warehouses.find((warehouse) => warehouse.id === selectedId);
  const plottable = useMemo(() => warehouses.filter(hasValidCoordinates), [warehouses]);

  useEffect(() => {
    if (!map) return;
    const bounds = warehouseBounds(warehouses);
    if (bounds) map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 });
  }, [map, warehouses]);

  useEffect(() => {
    if (!map) return;
    let removed = false;
    const markers: Marker[] = [];
    import('maplibre-gl').then(({ Marker: MapMarker }) => {
      if (removed) return;
      for (const warehouse of plottable) {
        const marker = new MapMarker({ color: warehouse.id === selectedId ? '#f48120' : '#2658b8' })
          .setLngLat(toLngLat(warehouse))
          .addTo(map);
        marker.getElement().setAttribute('aria-label', `Xem kho ${warehouse.code} trên bản đồ`);
        marker.getElement().addEventListener('click', () => setSelectedId(warehouse.id));
        markers.push(marker);
      }
    });
    return () => {
      removed = true;
      markers.forEach((marker) => {
        marker.remove();
      });
    };
  }, [map, plottable, selectedId]);

  useEffect(() => {
    setSelectedId(focusedWarehouseId);
  }, [focusedWarehouseId]);

  useEffect(() => {
    if (selectedId && !warehouses.some((warehouse) => warehouse.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, warehouses]);

  useEffect(() => {
    if (!map || !selected || !hasValidCoordinates(selected)) return;
    map.flyTo({ center: toLngLat(selected), zoom: 15, essential: true });
  }, [map, selected]);

  const notice = !GOONG_STYLE_URL ? 'Chưa cấu hình VITE_GOONG_MAPTILES_KEY cho web.' : error;

  return (
    <LayerCard className="overflow-hidden p-0 ring ring-kumo-line">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <Text as="h2" variant="heading">
          Bản đồ kho
        </Text>
        <Text variant="secondary">
          Hiển thị {warehouses.length} kho ở trang {page}
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
                <button
                  type="button"
                  aria-label="Đóng thông tin kho"
                  onClick={() => setSelectedId(null)}
                >
                  ×
                </button>
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
