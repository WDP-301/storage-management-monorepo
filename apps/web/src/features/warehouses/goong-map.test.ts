import { describe, expect, it } from 'vitest';
import type { Warehouse } from '../../types/warehouse';
import { hasValidCoordinates, toLngLat, warehouseBounds } from './goong-map';

const warehouseAt = (latitude: number, longitude: number) => ({ latitude, longitude }) as Warehouse;

describe('Goong warehouse map coordinates', () => {
  it('converts API latitude/longitude to MapLibre longitude/latitude', () => {
    expect(toLngLat({ latitude: 10.7769, longitude: 106.7032 })).toEqual([106.7032, 10.7769]);
  });

  it('ignores missing or unusable warehouse coordinates', () => {
    expect(hasValidCoordinates(warehouseAt(0, 0))).toBe(false);
    expect(hasValidCoordinates(warehouseAt(91, 106))).toBe(false);
    expect(hasValidCoordinates(warehouseAt(10, Number.NaN))).toBe(false);
    expect(warehouseBounds([warehouseAt(0, 0)])).toBeNull();
  });

  it('fits valid markers with enough span for a single warehouse', () => {
    const bounds = warehouseBounds([warehouseAt(10.7769, 106.7032), warehouseAt(0, 0)]);
    expect(bounds).not.toBeNull();
    expect(bounds?.[0][0]).toBeLessThan(106.7032);
    expect(bounds?.[1][0]).toBeGreaterThan(106.7032);
    expect(bounds?.[0][1]).toBeLessThan(10.7769);
    expect(bounds?.[1][1]).toBeGreaterThan(10.7769);
  });
});
