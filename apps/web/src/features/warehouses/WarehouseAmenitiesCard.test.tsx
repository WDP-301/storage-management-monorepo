import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WarehouseAmenity } from '../../types/amenity';
import { WarehouseAmenitiesCard } from './WarehouseAmenitiesCard';

const amenity = (over: Partial<WarehouseAmenity> = {}): WarehouseAmenity => ({
  amenityId: 'am-1',
  code: 'CCTV',
  name: 'Camera',
  quantity: 2,
  note: null,
  isActive: true,
  ...over,
});

describe('WarehouseAmenitiesCard', () => {
  it('badges only retired amenities', () => {
    render(
      <WarehouseAmenitiesCard
        amenities={[amenity(), amenity({ amenityId: 'am-2', name: 'Ổ điện', isActive: false })]}
      />,
    );
    expect(screen.getAllByText('Ngừng dùng')).toHaveLength(1);
    expect(screen.getByText('Ổ điện ×2').parentElement?.textContent).toContain('Ngừng dùng');
  });

  it('shows no badge when isActive is missing from an older API', () => {
    const legacy = { ...amenity(), isActive: undefined } as unknown as WarehouseAmenity;
    render(<WarehouseAmenitiesCard amenities={[legacy]} />);
    expect(screen.queryByText('Ngừng dùng')).toBeNull();
  });

  it('shows the empty message', () => {
    render(<WarehouseAmenitiesCard amenities={[]} />);
    expect(screen.getByText('Chưa khai báo tiện ích.')).toBeTruthy();
  });
});
