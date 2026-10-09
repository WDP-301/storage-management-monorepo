import type { Map as MapLibreMap } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import { GOONG_MAX_ZOOM, GOONG_STYLE_URL, HCM_CENTER } from './goong-map';

let workerConfigured = false;

const VI_LOCALE = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Giữ Ctrl và cuộn để phóng to/thu nhỏ bản đồ',
  'CooperativeGesturesHandler.MacHelpText': 'Giữ ⌘ và cuộn để phóng to/thu nhỏ bản đồ',
  'CooperativeGesturesHandler.MobileHelpText': 'Dùng hai ngón tay để di chuyển bản đồ',
};

interface Options {
  /** Require Ctrl/⌘ + scroll to zoom, so a map inside a scrolling container does not trap the wheel. */
  cooperativeGestures?: boolean;
}

export function useGoongMap({ cooperativeGestures = false }: Options = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Options apply when the map is created; later changes do not rebuild it.
  const creationOptions = useRef({ cooperativeGestures });

  useEffect(() => {
    if (!GOONG_STYLE_URL || !containerRef.current) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    // The stylesheet travels with the library so pages without a map never download it.
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([{ Map: MapLibre, NavigationControl, setWorkerUrl }]) => {
        if (disposed || !containerRef.current) return;
        if (!workerConfigured) {
          setWorkerUrl(workerUrl);
          workerConfigured = true;
        }
        const instance = new MapLibre({
          container: containerRef.current,
          style: GOONG_STYLE_URL,
          center: HCM_CENTER,
          zoom: 11,
          maxZoom: GOONG_MAX_ZOOM,
          cooperativeGestures: creationOptions.current.cooperativeGestures,
          locale: VI_LOCALE,
        });
        mapRef.current = instance;
        instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        instance.on('load', () => {
          if (!disposed) setMap(instance);
        });
        instance.on('error', () => {
          if (!disposed && !instance.isStyleLoaded()) {
            setError(
              'Không tải được bản đồ Goong. Vui lòng kiểm tra Maptiles Key hoặc kết nối mạng.',
            );
          }
        });
        resizeObserver = new ResizeObserver(() => instance.resize());
        resizeObserver.observe(containerRef.current);
      })
      .catch(() => {
        if (!disposed) setError('Không khởi tạo được bản đồ. Vui lòng thử tải lại trang.');
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return { containerRef, map, error };
}
