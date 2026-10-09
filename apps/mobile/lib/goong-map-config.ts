/**
 * Goong map tiles configuration and coordinate conversion for MapLibre.
 *
 * Lives in `lib/` with zero runtime imports so `goong-map-config.test.cjs` can transpile and load
 * it standalone — the CJS test harness throws on any `require`.
 *
 * MapLibre orders coordinates as [longitude, latitude] while the API returns latitude first (and as
 * strings, already coerced upstream). Swapping them produces markers in the middle of the ocean and
 * no error at all, so every conversion goes through `toLngLat` and nothing else.
 */

import type { LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

/** Anything carrying warehouse coordinates. */
type Located = { latitude: number; longitude: number };

const STYLE_URL = 'https://tiles.goong.io/assets/goong_map_web.json';

/** Ho Chi Minh City, mirroring the API's `GOONG_DEFAULT_LOCATION` with the pair swapped. */
export const HCM_CENTER: LngLat = [106.700806, 10.776889];
export const DEFAULT_ZOOM = 11;

/**
 * Goong's tileset stops at zoom 17 (verified against the style JSON in Phase 00). Asking MapLibre
 * for more yields blank tiles rather than an error, so callers clamp to this.
 */
export const MAX_ZOOM = 17;

/** Padding (px) left around fitted bounds so pins never sit under the sheet or the screen edge. */
export const FIT_PADDING = 56;

/**
 * Smallest span (degrees) a fitted box may have. A single marker yields a zero-size box, which
 * `fitBounds` resolves to maximum zoom — a view of one rooftop. ~0.02° ≈ 2 km.
 */
const MIN_SPAN = 0.02;

/** Metro inlines `EXPO_PUBLIC_*` at bundle time, so this is a constant per build. */
const apiKey = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';

/** `false` means the map screen must show a configuration notice instead of a blank grey map. */
export const hasMapTilesKey = apiKey.length > 0;

/** Style URL for `<Map mapStyle={...}>`. Empty string when unconfigured — never render the map then. */
export const goongStyleUrl = hasMapTilesKey ? `${STYLE_URL}?api_key=${apiKey}` : '';

/** Rejects missing coordinates: `toNumber` upstream turns null into 0, which maps to the Atlantic. */
export function hasPlottableCoords(point: Located): boolean {
  const { latitude, longitude } = point;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

/** The one place latitude/longitude becomes MapLibre's [lng, lat]. */
export function toLngLat(point: Located): LngLat {
  return [point.longitude, point.latitude];
}

/**
 * Bounding box over every plottable point, as MapLibre's flat [west, south, east, north].
 *
 * Returns `null` when nothing is plottable so the caller keeps its initial camera. Vietnam spans
 * roughly 102–110°E, never crossing the antimeridian, so plain min/max is correct here.
 */
export function toLngLatBounds(points: readonly Located[]): LngLatBounds | null {
  const usable = points.filter(hasPlottableCoords);
  if (usable.length === 0) return null;

  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const point of usable) {
    west = Math.min(west, point.longitude);
    east = Math.max(east, point.longitude);
    south = Math.min(south, point.latitude);
    north = Math.max(north, point.latitude);
  }

  const padX = Math.max(0, MIN_SPAN - (east - west)) / 2;
  const padY = Math.max(0, MIN_SPAN - (north - south)) / 2;
  return [west - padX, south - padY, east + padX, north + padY];
}

const EARTH_RADIUS_KM = 6371;

/**
 * Closed ring approximating a `radiusKm` circle around `center`, for drawing the nearby-search
 * area. Uses the destination-point formula, so it stays round at Vietnam's latitudes instead of
 * squashing into an ellipse like a naive degrees offset would.
 */
export function circlePolygon(
  center: { lat: number; lng: number },
  radiusKm: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(center.lat);
  const lng1 = toRad(center.lng);
  const angular = radiusKm / EARTH_RADIUS_KM;
  const ring: number[][] = [];

  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * (i % steps)) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([toDeg(lng2), toDeg(lat2)]);
  }

  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}
