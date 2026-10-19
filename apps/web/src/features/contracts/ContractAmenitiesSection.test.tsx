import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContractAmenitiesSection } from './ContractAmenitiesSection';

const amenity = (over = {}) => ({
  amenityId: 'am-1',
  code: 'CCTV',
  name: 'Camera',
  quantity: 2,
  note: 'Gần cửa',
  ...over,
});

describe('ContractAmenitiesSection', () => {
  it('says nothing was recorded for a contract without a snapshot', () => {
    render(<ContractAmenitiesSection amenities={null} />);
    expect(screen.getByText(/Chưa ghi nhận/)).toBeTruthy();
    expect(screen.queryByText(/Kho không có tiện ích/)).toBeNull();
  });

  it('says the warehouse had none for an empty snapshot', () => {
    render(<ContractAmenitiesSection amenities={[]} />);
    expect(screen.getByText('Kho không có tiện ích nào khi lập hợp đồng.')).toBeTruthy();
    expect(screen.queryByText(/Chưa ghi nhận/)).toBeNull();
  });

  it('lists name, quantity and note without a retired badge', () => {
    render(<ContractAmenitiesSection amenities={[amenity()]} unitKind="SELF_STORAGE" />);
    expect(screen.getByText('Camera ×2')).toBeTruthy();
    expect(screen.getByText(/Gần cửa/)).toBeTruthy();
    expect(screen.queryByText('Ngừng dùng')).toBeNull();
    expect(screen.queryByText(/Tiện ích chung của toà nhà/)).toBeNull();
  });

  it('notes building-wide amenities for a shelf', () => {
    render(<ContractAmenitiesSection amenities={[amenity()]} unitKind="SHELF" />);
    expect(screen.getByText('Tiện ích chung của toà nhà kho kệ.')).toBeTruthy();
  });

  it('shows the shared-building note only alongside a recorded list', () => {
    render(<ContractAmenitiesSection amenities={null} unitKind="SHELF" />);
    expect(screen.queryByText(/Tiện ích chung của toà nhà/)).toBeNull();
  });
});
