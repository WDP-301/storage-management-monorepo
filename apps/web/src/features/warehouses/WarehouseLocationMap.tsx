import type { Marker } from 'maplibre-gl';
import { useEffect } from 'react';
import { type Coordinates, GOONG_STYLE_URL, hasValidCoordinates, toLngLat } from './goong-map';
import { useGoongMap } from './useGoongMap';

interface Props {
  point: Coordinates | null;
  onPointChange: (point: Coordinates) => void;
}

export function WarehouseLocationMap({ point, onPointChange }: Props) {
  const { containerRef, map, error } = useGoongMap();

  useEffect(() => {
    if (!map) return;
    const handleClick = (event: { lngLat: { lat: number; lng: number } }) => {
      onPointChange({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onPointChange]);

  useEffect(() => {
    if (!map || !point || !hasValidCoordinates(point)) return;
    map.easeTo({ center: toLngLat(point), zoom: Math.max(map.getZoom(), 15), duration: 0 });
  }, [map, point]);

  useEffect(() => {
    if (!map || !point || !hasValidCoordinates(point)) return;
    let removed = false;
    let marker: Marker | undefined;
    import('maplibre-gl').then(({ Marker: MapMarker }) => {
      if (removed) return;
      marker = new MapMarker({ draggable: true, color: '#f48120' })
        .setLngLat(toLngLat(point))
        .addTo(map);
      marker.on('dragend', () => {
        if (!marker) return;
        const { lat, lng } = marker.getLngLat();
        onPointChange({ latitude: lat, longitude: lng });
      });
    });
    return () => {
      removed = true;
      marker?.remove();
    };
  }, [map, point, onPointChange]);

  if (!GOONG_STYLE_URL || error) {
    return (
      <div
        role="alert"
        className="rounded-lg bg-kumo-control px-4 py-3 text-kumo-subtle ring ring-kumo-line"
      >
        {error ??
          'Chưa cấu hình VITE_GOONG_MAPTILES_KEY cho web. Bạn vẫn có thể nhập tọa độ thủ công.'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-kumo-subtle">Click bản đồ hoặc kéo ghim để chọn vị trí kho.</p>
      <section
        ref={containerRef}
        aria-label="Bản đồ chọn vị trí kho"
        className="h-64 w-full overflow-hidden rounded-lg ring ring-kumo-line"
      />
    </div>
  );
}
