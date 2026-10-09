import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../lib/api';
import type { Warehouse } from '../../types/warehouse';
import { describeWarehouseError } from './warehouse-display';
import { buildPatch, computeDerived, toFormState, validateForm } from './warehouse-form';

const warehouse: Warehouse = {
  id: 'w',
  facility: { id: 'fac-1', code: 'CN-HCM', name: 'Cơ sở Hồ Chí Minh' },
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

  it('skips frozen size checks for an occupied warehouse without a stored height', () => {
    const occupied = { ...warehouse, heightM: null };
    expect(validateForm(toFormState(occupied), true)).toBeNull();
    expect(validateForm(toFormState(occupied), false)).toContain('lớn hơn 0');
  });

  it('requires a facility and enforces side, price and decimal limits', () => {
    const ok = toFormState({ ...warehouse, status: 'AVAILABLE' });
    expect(validateForm(ok)).toBeNull();
    expect(validateForm({ ...ok, facilityId: '' })).toContain('chọn cơ sở');
    expect(validateForm({ ...ok, widthM: '1000.5' })).toContain('tối đa 1000 m');
    expect(validateForm({ ...ok, lengthM: '3.456' })).toContain('2 chữ số thập phân');
    expect(validateForm({ ...ok, monthlyPrice: '100000000001' })).toContain('Giá thuê');
    expect(validateForm({ ...ok, monthlyPrice: '10.005' })).toContain('2 chữ số thập phân');
  });

  it('rejects 0,0 as a location but accepts a single zero coordinate', () => {
    const ok = toFormState({ ...warehouse, status: 'AVAILABLE' });
    expect(validateForm({ ...ok, latitude: '0', longitude: '0' })).toContain('tọa độ hợp lệ');
    expect(validateForm({ ...ok, latitude: '0', longitude: '106' })).toBeNull();
  });

  it('sends facilityId only when it changed and never for an occupied warehouse', () => {
    const idle = { ...warehouse, status: 'AVAILABLE' as const };
    const moved = { ...toFormState(idle), facilityId: 'fac-2' };
    expect(buildPatch(moved, idle)).toEqual({ facilityId: 'fac-2' });
    expect(buildPatch({ ...toFormState(warehouse), facilityId: 'fac-2' }, warehouse)).toEqual({});
  });

  it('maps the inactive-facility and open-ticket 409s to Vietnamese', () => {
    const inactive = Object.assign(new Error('x'), {
      status: 409,
      details: { facilityStatus: 'INACTIVE', fields: ['facilityId'] },
    }) as ApiError;
    expect(describeWarehouseError(inactive, 'f')).toBe(
      'Cơ sở đang ngừng hoạt động, không thể thêm hoặc chuyển kho vào đó.',
    );
    const tickets = Object.assign(new Error('x'), {
      status: 409,
      details: { openTickets: 2 },
    }) as ApiError;
    expect(describeWarehouseError(tickets, 'f')).toBe(
      'Kho còn yêu cầu hỗ trợ đang mở, hãy xử lý xong trước khi chuyển cơ sở.',
    );
  });

  it('maps a 409 facility move and 400 validation fields to Vietnamese', () => {
    const move = Object.assign(new Error('x'), {
      status: 409,
      details: { status: 'RENTED', fields: ['facilityId'] },
    }) as ApiError;
    expect(describeWarehouseError(move, 'f')).toContain('không thể đổi cơ sở');
    const validation = Object.assign(new Error('Validation failed'), {
      status: 400,
      details: {
        fields: [
          { field: 'widthM', code: 'max', message: 'x' },
          { field: 'monthlyPrice', code: 'maxDecimalPlaces', message: 'y' },
        ],
      },
    }) as ApiError;
    const text = describeWarehouseError(validation, 'f');
    expect(text).toContain('Chiều rộng vượt quá');
    expect(text).toContain('Giá thuê chỉ được tối đa 2 chữ số thập phân');
    expect(text).not.toContain('Validation failed');
  });
});
