import { UserRole } from '@storage/types';
import { describe, expect, it } from 'vitest';
import { getRoleDefaultPath } from './roles';

describe('role landing paths', () => {
  it('lands operations managers on warehouse management', () => {
    expect(getRoleDefaultPath(UserRole.OPERATIONS_MANAGER)).toBe('/admin/warehouses');
  });

  it('keeps admin and facility manager landings', () => {
    expect(getRoleDefaultPath(UserRole.ADMIN)).toBe('/admin/users');
    expect(getRoleDefaultPath(UserRole.FACILITY_MANAGER)).toBe('/facility-manager');
  });
});
