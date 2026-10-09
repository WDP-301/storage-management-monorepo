import type { MapMouseEvent, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { type Coordinates, GOONG_STYLE_URL, hasValidCoordinates, toLngLat } from './goong-map';
import { useGoongMap } from './useGoongMap';

interface Props {
  point: Coordinates | null;
  onPointChange: (point: Coordinates) => void;
}

/** Typed coordinates settle for this long before the map recentres on them. */
const RECENTER_DELAY_MS = 400;

const pointKey = (point: Coordinates) =>
  `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;

export function WarehouseLocationMap({ point, onPointChange }: Props) {
  const { containerRef, map, error } = useGoongMap({ cooperativeGestures: true });
  const [marker, setMarker] = useState<Marker | null>(null);
  const onPointChangeRef = useRef(onPointChange);
  // The last point this map reported; echoing it back must not move the camera.
  const emittedKey = useRef<string | null>(null);
  const centeredOnce = useRef(false);

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    if (!map) return;
    let disposed = false;
    let created: Marker | undefined;
    import('maplibre-gl').then(({ Marker: MapMarker }) => {
      if (disposed) return;
      created = new MapMarker({ draggable: true, color: '#f48120' });
      created.on('dragend', () => {
        if (!created) return;
        const { lat, lng } = created.getLngLat();
        const next = { latitude: lat, longitude: lng };
        emittedKey.current = pointKey(next);
        onPointChangeRef.current(next);
      });
      setMarker(created);
    });
    return () => {
      disposed = true;
      created?.remove();
      setMarker(null);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const handleClick = (event: MapMouseEvent) => {
      // The marker sits inside the map, so clicking it also reaches the map with the cursor's
      // position, a few pixels above the pin's tip; treat that as no change.
      const target = event.originalEvent.target;
      if (marker && target instanceof Node && marker.getElement().contains(target)) return;
      const next = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
      emittedKey.current = pointKey(next);
      onPointChangeRef.current(next);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, marker]);

  useEffect(() => {
    if (!map || !marker) return;
    if (!point || !hasValidCoordinates(point)) {
      marker.remove();
      return;
    }
    marker.setLngLat(toLngLat(point));
    if (!marker.getElement().isConnected) marker.addTo(map);
  }, [map, marker, point]);

  useEffect(() => {
    if (!map || !point || !hasValidCoordinates(point)) return;
    if (pointKey(point) === emittedKey.current) return;
    if (!centeredOnce.current) {
      centeredOnce.current = true;
      map.jumpTo({ center: toLngLat(point), zoom: Math.max(map.getZoom(), 15) });
      return;
    }
    const timer = window.setTimeout(() => {
      map.easeTo({ center: toLngLat(point), zoom: Math.max(map.getZoom(), 15) });
    }, RECENTER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [map, point]);

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
