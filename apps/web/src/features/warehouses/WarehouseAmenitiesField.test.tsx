import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Amenity } from '../../types/amenity';
import { WarehouseAmenitiesField } from './WarehouseAmenitiesField';
import type { AmenityCatalogStatus, AmenityRow } from './warehouse-amenities';

const CCTV = { id: 'a1', code: 'CCTV', name: 'Camera', isActive: true } as Amenity;
const ROWS: AmenityRow[] = [{ amenityId: 'a1', name: 'Camera', quantity: '1', note: '' }];

const renderField = (catalog: Amenity[], catalogStatus: AmenityCatalogStatus) =>
  render(
    <WarehouseAmenitiesField
      rows={ROWS}
      catalog={catalog}
      catalogStatus={catalogStatus}
      onChange={() => {}}
    />,
  );

describe('WarehouseAmenitiesField', () => {
  it('does not mark rows as retired while the catalog is still loading', () => {
    renderField([], 'loading');
    expect(screen.queryByText('Ngừng dùng')).toBeNull();
    expect(screen.getByText('Đang tải danh sách tiện ích…')).toBeTruthy();
  });

  it('marks a row retired once the loaded catalog no longer lists it', () => {
    renderField([], 'ready');
    expect(screen.getByText('Ngừng dùng')).toBeTruthy();
  });

  it('shows an active row without the retired badge', () => {
    renderField([CCTV], 'ready');
    expect(screen.queryByText('Ngừng dùng')).toBeNull();
  });
});
