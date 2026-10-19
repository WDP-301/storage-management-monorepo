import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../lib/api';
import type { Amenity } from '../../types/amenity';
import {
  buildAmenityPatch,
  buildAmenityPayload,
  describeAmenityError,
  EMPTY_AMENITY_FORM,
  toAmenityFormState,
  validateAmenityForm,
} from './amenity-form';

const stored: Amenity = {
  id: 'a1',
  code: 'CCTV',
  name: 'Camera an ninh',
  description: null,
  isActive: true,
  sortOrder: 10,
};

const form = { ...EMPTY_AMENITY_FORM, code: 'wifi', name: 'Wi-Fi' };

describe('amenity form', () => {
  it('upper-cases the code in the create payload', () => {
    expect(buildAmenityPayload({ ...form, code: ' wifi ' })).toEqual({
      code: 'WIFI',
      name: 'Wi-Fi',
      sortOrder: 0,
    });
  });

  it('accepts a lower-case code but rejects characters outside A-Z, 0-9 and underscore', () => {
    expect(validateAmenityForm(form, false)).toBeNull();
    expect(validateAmenityForm({ ...form, code: 'wi-fi' }, false)).not.toBeNull();
    expect(validateAmenityForm({ ...form, code: '1WIFI' }, false)).not.toBeNull();
    expect(validateAmenityForm({ ...form, code: 'W' }, false)).not.toBeNull();
  });

  it('ignores the code when editing', () => {
    expect(validateAmenityForm({ ...form, code: '' }, true)).toBeNull();
  });

  it('rejects an empty name and out-of-range fields', () => {
    expect(validateAmenityForm({ ...form, name: '  ' }, false)).not.toBeNull();
    expect(validateAmenityForm({ ...form, name: 'x'.repeat(101) }, false)).not.toBeNull();
    expect(validateAmenityForm({ ...form, description: 'x'.repeat(501) }, false)).not.toBeNull();
    expect(validateAmenityForm({ ...form, sortOrder: '10000' }, false)).not.toBeNull();
    expect(validateAmenityForm({ ...form, sortOrder: '-1' }, false)).not.toBeNull();
    expect(validateAmenityForm({ ...form, sortOrder: '1.5' }, false)).not.toBeNull();
  });

  it('patches only the changed fields and never the code', () => {
    const unchanged = toAmenityFormState(stored);
    expect(buildAmenityPatch(unchanged, stored)).toEqual({});
    expect(buildAmenityPatch({ ...unchanged, name: 'Camera' }, stored)).toEqual({ name: 'Camera' });
    expect(buildAmenityPatch({ ...unchanged, description: 'Ghi hình 24/7' }, stored)).toEqual({
      description: 'Ghi hình 24/7',
    });
    expect(buildAmenityPatch({ ...unchanged, sortOrder: '3' }, stored)).toEqual({ sortOrder: 3 });
  });

  it('clears the description with null', () => {
    const withText = { ...stored, description: 'cũ' };
    expect(
      buildAmenityPatch({ ...toAmenityFormState(withText), description: '' }, withText),
    ).toEqual({ description: null });
  });

  it('maps a duplicate code conflict to a readable message', () => {
    const err = Object.assign(new Error('conflict'), { status: 409 }) as ApiError;
    expect(describeAmenityError(err, 'x')).toBe('Mã tiện ích đã tồn tại.');
    expect(describeAmenityError('boom', 'fallback')).toBe('fallback');
  });
});
