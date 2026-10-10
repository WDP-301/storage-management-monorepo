import { describe, expect, it } from 'vitest';
import type { WarehouseStatus } from '../../types/warehouse';
import { countByMapStatus, MAP_STATUS_GROUPS, mapStatusGroup } from './warehouse-map-status';

describe('warehouse map status groups', () => {
  it('gives free, deposit-paid and rented warehouses their own marker colour', () => {
    expect(mapStatusGroup('AVAILABLE')).toBe('available');
    expect(mapStatusGroup('BOOKED')).toBe('booked');
    expect(mapStatusGroup('RENTED')).toBe('rented');
    const colours = new Set(
      (['available', 'booked', 'rented'] as const).map((group) => MAP_STATUS_GROUPS[group].color),
    );
    expect(colours.size).toBe(3);
  });

  it('shares one colour for the transitional and idle statuses', () => {
    expect(mapStatusGroup('HELD')).toBe('pending');
    expect(mapStatusGroup('PENDING_INSPECTION')).toBe('pending');
    expect(mapStatusGroup('MAINTENANCE')).toBe('maintenance');
    expect(mapStatusGroup('INACTIVE')).toBe('inactive');
  });

  it('uses a distinct colour for every legend group', () => {
    const colours = Object.values(MAP_STATUS_GROUPS).map((group) => group.color);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it('counts warehouses per legend group', () => {
    const statuses: WarehouseStatus[] = [
      'AVAILABLE',
      'AVAILABLE',
      'BOOKED',
      'RENTED',
      'HELD',
      'PENDING_INSPECTION',
      'INACTIVE',
    ];
    expect(countByMapStatus(statuses.map((status) => ({ status })))).toEqual({
      available: 2,
      booked: 1,
      rented: 1,
      pending: 2,
      maintenance: 0,
      inactive: 1,
    });
  });
});
