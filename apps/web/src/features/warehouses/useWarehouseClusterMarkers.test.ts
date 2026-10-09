import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clusterFeature, FakeMap, FakeMarker, pointFeature } from '../../test-utils/fake-maplibre';
import type { Warehouse } from '../../types/warehouse';
import { useWarehouseClusterMarkers } from './useWarehouseClusterMarkers';
import { MAP_STATUS_GROUPS } from './warehouse-map-status';

type MarkerClass = typeof import('maplibre-gl').Marker;

const wh = (id: string, over: Partial<Warehouse> = {}): Warehouse =>
  ({
    id,
    code: id.toUpperCase(),
    latitude: 10.77,
    longitude: 106.7,
    status: 'AVAILABLE',
    ...over,
  }) as Warehouse;

const SG = wh('sg-01', { latitude: 10.77, longitude: 106.7 });
const TD = wh('td-01', { latitude: 10.85, longitude: 106.77, status: 'RENTED' });

interface HookProps {
  warehouses: Warehouse[];
  selectedId: string | null;
}

describe('useWarehouseClusterMarkers', () => {
  let map: FakeMap;
  let onSelect: ReturnType<typeof vi.fn<(id: string) => void>>;

  const renderMarkers = (initial: HookProps) =>
    renderHook(
      ({ warehouses, selectedId }: HookProps) =>
        useWarehouseClusterMarkers({
          map: map as unknown as MapLibreMap,
          MapMarker: FakeMarker as unknown as MarkerClass,
          warehouses,
          selectedId,
          onSelect,
        }),
      { initialProps: initial },
    );

  beforeEach(() => {
    map = new FakeMap();
    onSelect = vi.fn<(id: string) => void>();
    FakeMarker.instances = [];
  });

  afterEach(() => map.destroy());

  it('feeds the warehouses to one clustered source with an invisible anchor layer', () => {
    const { rerender } = renderMarkers({ warehouses: [SG, TD], selectedId: null });

    const source = map.getSource('warehouse-points');
    expect(source?.spec).toMatchObject({ type: 'geojson', cluster: true });
    expect(map.layers).toHaveLength(1);
    expect(map.layers[0]).toMatchObject({
      source: 'warehouse-points',
      paint: { 'circle-radius': 0, 'circle-opacity': 0 },
    });
    expect(source?.data).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'sg-01' },
          geometry: { type: 'Point', coordinates: [106.7, 10.77] },
        },
        {
          type: 'Feature',
          properties: { id: 'td-01' },
          geometry: { type: 'Point', coordinates: [106.77, 10.85] },
        },
      ],
    });

    rerender({ warehouses: [TD], selectedId: null });
    expect(map.sources.size).toBe(1);
    expect(source?.setData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        features: [expect.objectContaining({ properties: { id: 'td-01' } })],
      }),
    );
  });

  it('draws a numbered cluster that zooms to its expansion level', async () => {
    renderMarkers({ warehouses: [SG, TD], selectedId: null });
    map.showFeatures([clusterFeature(7, 2, [106.73, 10.8])]);

    const cluster = screen.getByRole('button', { name: 'Cụm 2 kho, bấm để phóng to' });
    expect(cluster.textContent).toBe('2');
    fireEvent.click(cluster);

    const source = map.getSource('warehouse-points');
    expect(source?.getClusterExpansionZoom).toHaveBeenCalledWith(7);
    await waitFor(() =>
      expect(map.easeTo).toHaveBeenCalledWith({ center: [106.73, 10.8], zoom: 12 }),
    );
  });

  it('falls back to zooming in two levels when the expansion zoom is unavailable', async () => {
    renderMarkers({ warehouses: [SG, TD], selectedId: null });
    map
      .getSource('warehouse-points')
      ?.getClusterExpansionZoom.mockRejectedValueOnce(new Error('cluster gone'));
    map.showFeatures([clusterFeature(7, 2, [106.73, 10.8])]);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cụm 2 kho, bấm để phóng to' }), {
      key: 'Enter',
    });
    await waitFor(() =>
      expect(map.easeTo).toHaveBeenCalledWith({ center: [106.73, 10.8], zoom: 7 }),
    );
  });

  it('draws single warehouses as status-coloured pins that select on click or keyboard', () => {
    renderMarkers({ warehouses: [SG, TD], selectedId: null });
    map.showFeatures([
      pointFeature('sg-01', [106.7, 10.77]),
      pointFeature('td-01', [106.77, 10.85]),
    ]);

    const [sgMarker, tdMarker] = FakeMarker.live();
    expect(sgMarker.options).toEqual({ color: MAP_STATUS_GROUPS.available.color, scale: 1 });
    expect(tdMarker.options).toEqual({ color: MAP_STATUS_GROUPS.occupied.color, scale: 1 });
    expect(sgMarker.lngLat).toEqual([106.7, 10.77]);

    fireEvent.click(screen.getByRole('button', { name: 'Xem kho SG-01 trên bản đồ' }));
    expect(onSelect).toHaveBeenLastCalledWith('sg-01');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Xem kho TD-01 trên bản đồ' }), {
      key: ' ',
    });
    expect(onSelect).toHaveBeenLastCalledWith('td-01');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Xem kho TD-01 trên bản đồ' }), {
      key: 'a',
    });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('enlarges the selected pin and redraws only the pins whose look changed', () => {
    const { rerender } = renderMarkers({ warehouses: [SG, TD], selectedId: null });
    const features = [
      pointFeature('sg-01', [106.7, 10.77]),
      pointFeature('td-01', [106.77, 10.85]),
    ];
    map.showFeatures(features);
    const before = FakeMarker.instances.length;

    // A repaint with nothing changed keeps every marker.
    map.fire('render');
    expect(FakeMarker.instances).toHaveLength(before);

    rerender({ warehouses: [SG, TD], selectedId: 'sg-01' });
    const selected = screen.getByRole('button', { name: 'Xem kho SG-01 trên bản đồ' });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(FakeMarker.live().find((m) => m.element === selected)?.options.scale).toBe(1.35);

    const maintenance = { ...SG, status: 'MAINTENANCE' as const };
    rerender({ warehouses: [maintenance, TD], selectedId: 'sg-01' });
    map.fire('render');
    const redrawn = FakeMarker.live().find(
      (m) => m.element === screen.getByRole('button', { name: 'Xem kho SG-01 trên bản đồ' }),
    );
    expect(redrawn?.options.color).toBe(MAP_STATUS_GROUPS.maintenance.color);
    expect(FakeMarker.live()).toHaveLength(2);
  });

  it('keeps one marker per feature when tiles repeat it and drops markers that left view', () => {
    renderMarkers({ warehouses: [SG, TD], selectedId: null });
    const sg = pointFeature('sg-01', [106.7, 10.77]);
    map.showFeatures([sg, sg, pointFeature('td-01', [106.77, 10.85])]);
    expect(FakeMarker.live()).toHaveLength(2);

    map.showFeatures([sg]);
    expect(FakeMarker.live()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Xem kho TD-01 trên bản đồ' })).toBeNull();
  });

  it('ignores features of warehouses it was not given', () => {
    renderMarkers({ warehouses: [SG], selectedId: null });
    map.showFeatures([pointFeature('gone', [106, 10]), pointFeature('sg-01', [106.7, 10.77])]);
    expect(FakeMarker.live()).toHaveLength(1);
  });

  it('waits for the source to load before drawing', () => {
    map.sourceLoaded = false;
    renderMarkers({ warehouses: [SG], selectedId: null });
    map.showFeatures([pointFeature('sg-01', [106.7, 10.77])]);
    expect(FakeMarker.live()).toHaveLength(0);

    map.sourceLoaded = true;
    map.fire('render');
    expect(FakeMarker.live()).toHaveLength(1);
  });

  it('removes its markers and render listener on unmount', () => {
    const { unmount } = renderMarkers({ warehouses: [SG], selectedId: null });
    map.showFeatures([pointFeature('sg-01', [106.7, 10.77])]);
    expect(map.listenerCount('render')).toBe(1);

    unmount();
    expect(map.listenerCount('render')).toBe(0);
    expect(FakeMarker.live()).toHaveLength(0);
  });

  it('does nothing until the map and marker class are ready', () => {
    renderHook(() =>
      useWarehouseClusterMarkers({
        map: null,
        MapMarker: null,
        warehouses: [SG],
        selectedId: null,
        onSelect,
      }),
    );
    expect(map.sources.size).toBe(0);
    expect(FakeMarker.instances).toHaveLength(0);
  });
});
