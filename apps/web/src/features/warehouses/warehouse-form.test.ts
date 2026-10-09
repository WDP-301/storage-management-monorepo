import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../lib/api';
import type { Warehouse } from '../../types/warehouse';
import { describeWarehouseError } from './warehouse-display';
import { buildPatch, computeDerived, toFormState } from './warehouse-form';

const warehouse: Warehouse = {
  id: 'w',
  unitId: 'u',
  code: 'A-01',
  name: 'Kho A',
  addressLine: 'Số 1',
  wardCode: null,
  provinceCode: null,
  latitude: 10,
  longitude: 106,
  widthM: 3,
  lengthM: 4,
  heightM: 2,
  areaM2: 12,
  volumeM3: 24,
  monthlyPrice: 1000000,
  depositMonths: 3,
  effectiveDepositMonths: 3,
  status: 'RENTED',
  notes: null,
  createdAt: '',
  updatedAt: '',
};

describe('warehouse form helpers', () => {
  it('computes area and volume only from valid dimensions', () => {
    expect(computeDerived({ widthM: '3', lengthM: '4', heightM: '2' })).toEqual({
      area: 12,
      volume: 24,
    });
    expect(computeDerived({ widthM: '3', lengthM: '', heightM: '2' })).toEqual({
      area: null,
      volume: null,
    });
  });

  it('patches only changed fields and never resends frozen ones for occupied warehouses', () => {
    const form = { ...toFormState(warehouse), monthlyPrice: '1200000', depositMonths: 'default' };
    expect(buildPatch(form, warehouse)).toEqual({ monthlyPrice: 1200000, depositMonths: null });
  });

  it('clears the stored ward when the province changes and no ward is picked', () => {
    const placed = {
      ...warehouse,
      status: 'AVAILABLE' as const,
      provinceCode: '79',
      wardCode: '26740',
    };
    const form = { ...toFormState(placed), provinceCode: '01', wardCode: '' };
    expect(buildPatch(form, placed)).toEqual({ provinceCode: '01', wardCode: null });
  });

  it('maps frozen-field and open-tour conflicts to Vietnamese messages', () => {
    const frozen = Object.assign(new Error('x'), {
      status: 409,
      details: { status: 'RENTED', fields: ['widthM', 'code'] },
    }) as ApiError;
    expect(describeWarehouseError(frozen, 'f')).toContain('chiều rộng, mã kho');
    const tours = Object.assign(new Error('x'), {
      status: 409,
      details: { status: 'AVAILABLE', openTours: 2 },
    }) as ApiError;
    expect(describeWarehouseError(tours, 'f')).toContain('2 lịch xem kho');
  });

  it('translates ward/province mismatch', () => {
    const err = Object.assign(new Error('Ward 1 does not belong to province 2'), {
      status: 400,
    }) as ApiError;
    expect(describeWarehouseError(err, 'f')).toContain('không thuộc tỉnh');
  });
});
