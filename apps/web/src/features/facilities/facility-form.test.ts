import { describe, expect, it } from 'vitest';
import type { ApiError, FacilityRecord } from '../../lib/api';
import {
  buildFacilityCreate,
  buildFacilityPatch,
  describeFacilityError,
  EMPTY_FACILITY_FORM,
  NO_REGION,
  toFacilityForm,
  validateFacilityForm,
} from './facility-form';

const facility: FacilityRecord = {
  id: 'f1',
  code: 'CN-HCM',
  name: 'Chi nhánh Hồ Chí Minh',
  provinceCode: '79',
  status: 'ACTIVE',
  warehouseCount: 3,
};

describe('facility form helpers', () => {
  it('requires a code and a name within API length limits', () => {
    expect(validateFacilityForm(EMPTY_FACILITY_FORM)).toContain('mã chi nhánh');
    expect(validateFacilityForm({ ...EMPTY_FACILITY_FORM, code: 'A' })).toContain('tên chi nhánh');
    expect(
      validateFacilityForm({ code: 'A'.repeat(51), name: 'x', provinceCode: NO_REGION }),
    ).toContain('50');
    expect(validateFacilityForm({ code: 'A', name: 'B', provinceCode: NO_REGION })).toBeNull();
  });

  it('omits the region on create when none is picked', () => {
    expect(
      buildFacilityCreate({ code: ' CN-HN ', name: ' Hà Nội ', provinceCode: NO_REGION }),
    ).toEqual({
      code: 'CN-HN',
      name: 'Hà Nội',
    });
  });

  it('patches only changed fields and clears the region with null', () => {
    const form = toFacilityForm(facility);
    expect(buildFacilityPatch(form, facility)).toEqual({});
    expect(buildFacilityPatch({ ...form, name: 'Mới', provinceCode: NO_REGION }, facility)).toEqual(
      {
        name: 'Mới',
        provinceCode: null,
      },
    );
  });

  it('maps duplicate code to Vietnamese', () => {
    const err = Object.assign(new Error('Facility code already exists'), {
      status: 409,
    }) as ApiError;
    expect(describeFacilityError(err, 'f')).toContain('Mã chi nhánh đã tồn tại');
  });
});
