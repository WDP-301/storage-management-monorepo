import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlacesApi } from '../../lib/api';
import { WarehouseAddressPicker } from './WarehouseAddressPicker';

const toast = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }));
vi.mock('../../lib/toast', () => ({ useAppToast: () => toast }));

const DETAIL = {
  placeId: 'p-1',
  address: '45 Lê Thánh Tôn, Bến Nghé',
  lat: 10.7769,
  lng: 106.7032,
};

function Harness({
  onLocated,
  onPlacePicked = vi.fn(),
}: {
  onLocated: (p: { lat: number; lng: number }) => void;
  onPlacePicked?: (p: { address: string; lat: number; lng: number }) => void;
}) {
  const [address, setAddress] = useState('');
  return (
    <WarehouseAddressPicker
      addressLine={address}
      onAddressChange={setAddress}
      onPlacePicked={onPlacePicked}
      locateQuery={`${address}, Thành phố Hồ Chí Minh`}
      onLocated={onLocated}
    />
  );
}

const locateButton = () =>
  screen.getByRole('button', { name: 'Lấy tọa độ từ địa chỉ' }) as HTMLButtonElement;
const typeAddress = (value: string) =>
  fireEvent.change(screen.getByLabelText('Địa chỉ kho'), { target: { value } });

describe('WarehouseAddressPicker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('needs a typed address before it can locate', () => {
    render(<Harness onLocated={vi.fn()} />);
    expect(locateButton().disabled).toBe(true);
    typeAddress('   ');
    expect(locateButton().disabled).toBe(true);
    typeAddress('45 Lê Thánh Tôn');
    expect(locateButton().disabled).toBe(false);
  });

  it('geocodes the typed address with its area and fills only the coordinates', async () => {
    const autocomplete = vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([
      { place_id: 'p-1', description: '45 Lê Thánh Tôn, Bến Nghé, Quận 1, Hồ Chí Minh' },
      { place_id: 'p-2', description: '45 Lê Thánh Tôn, Thủ Dầu Một' },
    ]);
    const detail = vi.spyOn(PlacesApi, 'detail').mockResolvedValue(DETAIL);
    const onLocated = vi.fn();
    const onPlacePicked = vi.fn();
    render(<Harness onLocated={onLocated} onPlacePicked={onPlacePicked} />);

    typeAddress('45 Lê Thánh Tôn');
    fireEvent.click(locateButton());

    await waitFor(() => expect(onLocated).toHaveBeenCalledWith({ lat: 10.7769, lng: 106.7032 }));
    expect(autocomplete).toHaveBeenCalledWith('45 Lê Thánh Tôn, Thành phố Hồ Chí Minh');
    // Goong's best match is the first prediction.
    expect(detail).toHaveBeenCalledWith('p-1');
    expect(onPlacePicked).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Địa chỉ kho') as HTMLInputElement).value).toBe(
      '45 Lê Thánh Tôn',
    );
    expect(screen.getByRole('status').textContent).toBe(
      'Đã lấy tọa độ theo "45 Lê Thánh Tôn, Bến Nghé, Quận 1, Hồ Chí Minh". Kiểm tra ghim trên bản đồ bên dưới.',
    );

    // Editing the address makes the shown match stale.
    typeAddress('46 Lê Thánh Tôn');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('warns and keeps the coordinates when the address is not found', async () => {
    vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([]);
    const detail = vi.spyOn(PlacesApi, 'detail');
    const onLocated = vi.fn();
    render(<Harness onLocated={onLocated} />);

    typeAddress('đâu đó không có thật');
    fireEvent.click(locateButton());

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith('Không tìm thấy vị trí', expect.any(String)),
    );
    expect(detail).not.toHaveBeenCalled();
    expect(onLocated).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(locateButton().disabled).toBe(false);
  });

  it('reports a geocoding failure', async () => {
    vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([
      { place_id: 'p-1', description: '45 Lê Thánh Tôn' },
    ]);
    vi.spyOn(PlacesApi, 'detail').mockRejectedValue(new Error('Goong service is unreachable'));
    const onLocated = vi.fn();
    render(<Harness onLocated={onLocated} />);

    typeAddress('45 Lê Thánh Tôn');
    fireEvent.click(locateButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Không lấy được tọa độ',
        'Goong service is unreachable',
      ),
    );
    expect(onLocated).not.toHaveBeenCalled();
  });

  it('fills address and coordinates from a picked suggestion', async () => {
    vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([
      { place_id: 'p-1', description: '45 Lê Thánh Tôn, Bến Nghé' },
    ]);
    vi.spyOn(PlacesApi, 'detail').mockResolvedValue(DETAIL);
    const onPlacePicked = vi.fn();
    render(<Harness onLocated={vi.fn()} onPlacePicked={onPlacePicked} />);

    fireEvent.change(screen.getByLabelText('Tìm địa chỉ (gợi ý từ bản đồ)'), {
      target: { value: '45 Lê' },
    });
    fireEvent.click(await screen.findByRole('button', { name: '45 Lê Thánh Tôn, Bến Nghé' }));

    await waitFor(() =>
      expect(onPlacePicked).toHaveBeenCalledWith({
        address: '45 Lê Thánh Tôn, Bến Nghé',
        lat: 10.7769,
        lng: 106.7032,
      }),
    );
  });
});
