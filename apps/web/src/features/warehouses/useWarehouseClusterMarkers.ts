import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import type { Warehouse } from '../../types/warehouse';
import { toLngLat } from './goong-map';
import { MAP_STATUS_GROUPS, mapStatusGroup } from './warehouse-map-status';

type MarkerClass = typeof import('maplibre-gl').Marker;

const SOURCE_ID = 'warehouse-points';
const ANCHOR_LAYER_ID = 'warehouse-points-anchor';
const CLUSTER_COLOR = '#1f2937';

interface Options {
  map: MapLibreMap | null;
  MapMarker: MarkerClass | null;
  /** Warehouses with valid coordinates. */
  warehouses: readonly Warehouse[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const toFeatureCollection = (warehouses: readonly Warehouse[]) => ({
  type: 'FeatureCollection' as const,
  features: warehouses.map((w) => ({
    type: 'Feature' as const,
    properties: { id: w.id },
    geometry: { type: 'Point' as const, coordinates: toLngLat(w) },
  })),
});

function makeAccessible(element: HTMLElement, label: string, onActivate: () => void) {
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', label);
  element.addEventListener('click', (event) => {
    // A marker sits on the map canvas; the click must not reach the map underneath.
    event.stopPropagation();
    onActivate();
  });
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  });
}

function clusterElement(count: number): HTMLElement {
  const element = document.createElement('div');
  const size = count < 10 ? 34 : count < 100 ? 40 : 48;
  Object.assign(element.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '9999px',
    background: CLUSTER_COLOR,
    color: '#fff',
    border: '3px solid rgba(255, 255, 255, 0.85)',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  });
  element.textContent = String(count);
  return element;
}

/**
 * Draws warehouses as status-coloured pins, merging nearby pins into a numbered cluster that
 * zooms in on click. Clustering runs in a GeoJSON source; markers stay DOM elements so they
 * remain focusable and clickable like buttons.
 */
export function useWarehouseClusterMarkers({
  map,
  MapMarker,
  warehouses,
  selectedId,
  onSelect,
}: Options) {
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const byId = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);

  // The source lives as long as the map, which is removed together with this component.
  useEffect(() => {
    if (!map || map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: toFeatureCollection([]),
      cluster: true,
      clusterRadius: 48,
      clusterMaxZoom: 14,
    });
    // Source tiles only load for a source some layer uses; this layer draws nothing.
    map.addLayer({
      id: ANCHOR_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: { 'circle-radius': 0, 'circle-opacity': 0 },
    });
  }, [map]);

  useEffect(() => {
    map?.getSource<GeoJSONSource>(SOURCE_ID)?.setData(toFeatureCollection(warehouses));
  }, [map, warehouses]);

  useEffect(() => {
    if (!map || !MapMarker) return;
    // Keyed by cluster/warehouse; the signature tells when a marker must be redrawn.
    const shown = new Map<string, { marker: Marker; signature: string }>();

    const show = (key: string, signature: string, create: () => Marker) => {
      const existing = shown.get(key);
      if (existing?.signature === signature) return;
      existing?.marker.remove();
      shown.set(key, { marker: create().addTo(map), signature });
    };

    const sync = () => {
      if (!map.getSource(SOURCE_ID) || !map.isSourceLoaded(SOURCE_ID)) return;
      const visible = new Set<string>();
      for (const feature of map.querySourceFeatures(SOURCE_ID)) {
        const props = feature.properties ?? {};
        const lngLat = (feature.geometry as unknown as { coordinates: [number, number] })
          .coordinates;
        if (props.cluster) {
          const clusterId = Number(props.cluster_id);
          const count = Number(props.point_count);
          const key = `cluster:${clusterId}`;
          visible.add(key);
          show(key, `${count}|${lngLat.join(',')}`, () => {
            const element = clusterElement(count);
            makeAccessible(element, `Cụm ${count} kho, bấm để phóng to`, () => {
              map
                .getSource<GeoJSONSource>(SOURCE_ID)
                ?.getClusterExpansionZoom(clusterId)
                .then((zoom) => map.easeTo({ center: lngLat, zoom }))
                .catch(() => map.easeTo({ center: lngLat, zoom: map.getZoom() + 2 }));
            });
            return new MapMarker({ element }).setLngLat(lngLat);
          });
          continue;
        }
        const warehouse = byId.get(String(props.id));
        if (!warehouse) continue;
        const key = `warehouse:${warehouse.id}`;
        const isSelected = warehouse.id === selectedId;
        visible.add(key);
        show(key, `${warehouse.status}|${isSelected}|${lngLat.join(',')}`, () => {
          // The default pin's colour and size are fixed at creation, hence the redraw.
          const marker = new MapMarker({
            color: MAP_STATUS_GROUPS[mapStatusGroup(warehouse.status)].color,
            scale: isSelected ? 1.35 : 1,
          }).setLngLat(lngLat);
          const element = marker.getElement();
          element.setAttribute('aria-pressed', String(isSelected));
          makeAccessible(element, `Xem kho ${warehouse.code} trên bản đồ`, () =>
            onSelectRef.current(warehouse.id),
          );
          return marker;
        });
      }
      for (const [key, { marker }] of shown) {
        if (visible.has(key)) continue;
        marker.remove();
        shown.delete(key);
      }
    };

    map.on('render', sync);
    sync();
    return () => {
      map.off('render', sync);
      for (const { marker } of shown.values()) marker.remove();
      shown.clear();
    };
  }, [map, MapMarker, byId, selectedId]);
}
