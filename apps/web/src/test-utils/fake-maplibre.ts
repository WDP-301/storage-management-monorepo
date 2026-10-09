import { vi } from 'vitest';

/**
 * In-memory stand-ins for the MapLibre pieces the warehouse map touches. jsdom has no WebGL,
 * so tests drive "what the clustering engine returned" through `FakeMap.showFeatures`.
 */

type LngLat = [number, number];

export interface FakeFeature {
  properties: Record<string, unknown>;
  geometry: { type: 'Point'; coordinates: LngLat };
}

export const pointFeature = (id: string, coordinates: LngLat): FakeFeature => ({
  properties: { id },
  geometry: { type: 'Point', coordinates },
});

export const clusterFeature = (
  clusterId: number,
  count: number,
  coordinates: LngLat,
): FakeFeature => ({
  properties: { cluster: true, cluster_id: clusterId, point_count: count },
  geometry: { type: 'Point', coordinates },
});

export class FakeGeoJSONSource {
  data: unknown = null;
  constructor(readonly spec: Record<string, unknown>) {}
  setData = vi.fn((data: unknown) => {
    this.data = data;
  });
  getClusterExpansionZoom = vi.fn(async (_clusterId: number) => 12);
}

export class FakeMap {
  /** Markers attach here so Testing Library can find them in the document. */
  readonly container = document.body.appendChild(document.createElement('div'));
  readonly sources = new Map<string, FakeGeoJSONSource>();
  readonly layers: Record<string, unknown>[] = [];
  private readonly handlers = new Map<string, Set<() => void>>();
  features: FakeFeature[] = [];
  sourceLoaded = true;
  zoom = 5;

  easeTo = vi.fn();
  flyTo = vi.fn();
  fitBounds = vi.fn();
  resize = vi.fn();

  addSource(id: string, spec: Record<string, unknown>) {
    this.sources.set(id, new FakeGeoJSONSource(spec));
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  addLayer(layer: Record<string, unknown>) {
    this.layers.push(layer);
  }
  isSourceLoaded() {
    return this.sourceLoaded;
  }
  querySourceFeatures() {
    return this.features;
  }
  getZoom() {
    return this.zoom;
  }
  on(event: string, handler: () => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)?.add(handler);
  }
  off(event: string, handler: () => void) {
    this.handlers.get(event)?.delete(handler);
  }
  listenerCount(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }
  fire(event: string) {
    for (const handler of this.handlers.get(event) ?? []) handler();
  }
  /** Replaces what the clustered source reports for the viewport, then repaints. */
  showFeatures(features: FakeFeature[]) {
    this.features = features;
    this.fire('render');
  }
  destroy() {
    this.container.remove();
  }
}

export class FakeMarker {
  static instances: FakeMarker[] = [];
  readonly element: HTMLElement;
  lngLat: LngLat | null = null;
  removed = false;

  constructor(readonly options: { color?: string; scale?: number; element?: HTMLElement } = {}) {
    this.element = options.element ?? document.createElement('div');
    FakeMarker.instances.push(this);
  }
  setLngLat(lngLat: LngLat) {
    this.lngLat = lngLat;
    return this;
  }
  addTo(map: FakeMap) {
    map.container.appendChild(this.element);
    return this;
  }
  remove() {
    this.removed = true;
    this.element.remove();
    return this;
  }
  getElement() {
    return this.element;
  }
  static live() {
    return FakeMarker.instances.filter((marker) => !marker.removed);
  }
}
