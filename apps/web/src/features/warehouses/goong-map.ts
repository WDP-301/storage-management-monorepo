import type { Warehouse } from '../../types/warehouse';

export type Coordinates = { latitude: number; longitude: number };

export const HCM_CENTER: [number, number] = [106.700806, 10.776889];
export const GOONG_MAX_ZOOM = 17;
export const GOONG_MAPTILES_KEY = import.meta.env.VITE_GOONG_MAPTILES_KEY?.trim() ?? '';
export const GOONG_STYLE_URL = GOONG_MAPTILES_KEY
  ? `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(GOONG_MAPTILES_KEY)}`
  : '';

export function hasValidCoordinates(point: Coordinates): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    !(point.latitude === 0 && point.longitude === 0)
  );
}

export function toLngLat(point: Coordinates): [number, number] {
  return [point.longitude, point.latitude];
}

export function warehouseBounds(
  warehouses: readonly Warehouse[],
): [[number, number], [number, number]] | null {
  const points = warehouses.filter(hasValidCoordinates);
  if (points.length === 0) return null;

  const longitudes = points.map((point) => point.longitude);
  const latitudes = points.map((point) => point.latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const longitudePadding = Math.max(0, 0.02 - (east - west)) / 2;
  const latitudePadding = Math.max(0, 0.02 - (north - south)) / 2;
  return [
    [west - longitudePadding, south - latitudePadding],
    [east + longitudePadding, north + latitudePadding],
  ];
}
