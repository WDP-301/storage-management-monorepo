import { describe, expect, it } from 'vitest';
import type { WarehouseStatus } from '../../types/warehouse';
import { countByMapStatus, mapStatusGroup } from './warehouse-map-status';

describe('warehouse map status groups', () => {
  it('groups every occupied status under one marker colour', () => {
    const occupied: WarehouseStatus[] = ['HELD', 'BOOKED', 'RENTED', 'PENDING_INSPECTION'];
    for (const status of occupied) expect(mapStatusGroup(status)).toBe('occupied');
    expect(mapStatusGroup('AVAILABLE')).toBe('available');
    expect(mapStatusGroup('MAINTENANCE')).toBe('maintenance');
    expect(mapStatusGroup('INACTIVE')).toBe('inactive');
  });

  it('counts warehouses per legend group', () => {
    const statuses: WarehouseStatus[] = ['AVAILABLE', 'AVAILABLE', 'RENTED', 'HELD', 'INACTIVE'];
    expect(countByMapStatus(statuses.map((status) => ({ status })))).toEqual({
      available: 2,
      occupied: 2,
      maintenance: 0,
      inactive: 1,
    });
  });
});
