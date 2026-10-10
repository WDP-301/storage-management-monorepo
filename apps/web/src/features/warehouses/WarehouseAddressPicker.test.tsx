import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
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

  it('suggests addresses while typing in the address field and fills a picked one', async () => {
    const autocomplete = vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([
      { place_id: 'p-1', description: '01 Long Biên, Hà Nội' },
      { place_id: 'p-2', description: '01 Long Thuận, Thủ Đức' },
    ]);
    const detail = vi.spyOn(PlacesApi, 'detail').mockResolvedValue(DETAIL);
    const onPlacePicked = vi.fn();
    render(<Harness onLocated={vi.fn()} onPlacePicked={onPlacePicked} />);

    typeAddress('01 Long');
    const listbox = await screen.findByRole('listbox', { name: 'Gợi ý địa chỉ' });
    expect(autocomplete).toHaveBeenCalledWith('01 Long');
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['01 Long Biên, Hà Nội', '01 Long Thuận, Thủ Đức']);
    expect(
      screen.getByRole('combobox', { name: 'Địa chỉ kho' }).getAttribute('aria-expanded'),
    ).toBe('true');

    fireEvent.click(within(listbox).getByRole('option', { name: '01 Long Thuận, Thủ Đức' }));
    await waitFor(() =>
      expect(onPlacePicked).toHaveBeenCalledWith({
        address: '45 Lê Thánh Tôn, Bến Nghé',
        lat: 10.7769,
        lng: 106.7032,
      }),
    );
    expect(detail).toHaveBeenCalledWith('p-2');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('waits for three characters before asking for suggestions', async () => {
    const autocomplete = vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([]);
    render(<Harness onLocated={vi.fn()} />);
    typeAddress('01');
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it('picks with the arrow keys and Enter without submitting the form', async () => {
    vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([
      { place_id: 'p-1', description: '01 Long Biên, Hà Nội' },
      { place_id: 'p-2', description: '01 Long Thuận, Thủ Đức' },
    ]);
    const detail = vi.spyOn(PlacesApi, 'detail').mockResolvedValue(DETAIL);
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness onLocated={vi.fn()} />
      </form>,
    );

    typeAddress('01 Long');
    await screen.findByRole('listbox');
    const input = screen.getByRole('combobox', { name: 'Địa chỉ kho' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Wraps back to the first suggestion.
    expect(
      screen.getByRole('option', { name: '01 Long Biên, Hà Nội' }).getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const active = screen.getByRole('option', { name: '01 Long Thuận, Thủ Đức' });
    expect(input.getAttribute('aria-activedescendant')).toBe(active.id);

    // fireEvent returns false when the handler cancelled the key, i.e. no implicit submit.
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    await waitFor(() => expect(detail).toHaveBeenCalledWith('p-2'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes the suggestions on Escape or when the field loses focus', async () => {
    vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([
      { place_id: 'p-1', description: '01 Long Biên, Hà Nội' },
    ]);
    render(<Harness onLocated={vi.fn()} />);

    typeAddress('01 Long');
    await screen.findByRole('listbox');
    const input = screen.getByRole('combobox', { name: 'Địa chỉ kho' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.blur(input);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not open suggestions for an address that was not typed', async () => {
    const autocomplete = vi
      .spyOn(PlacesApi, 'autocomplete')
      .mockResolvedValue([{ place_id: 'p-1', description: '45 Lê Thánh Tôn' }]);
    render(
      <WarehouseAddressPicker
        addressLine="45 Lê Thánh Tôn"
        onAddressChange={vi.fn()}
        onPlacePicked={vi.fn()}
        locateQuery="45 Lê Thánh Tôn"
        onLocated={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByRole('combobox', { name: 'Địa chỉ kho' }));
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(autocomplete).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the list open and reports when a picked suggestion cannot be resolved', async () => {
    vi.spyOn(PlacesApi, 'autocomplete').mockResolvedValue([
      { place_id: 'p-1', description: '01 Long Biên, Hà Nội' },
    ]);
    vi.spyOn(PlacesApi, 'detail').mockRejectedValue(new Error('Invalid or expired place_id'));
    const onPlacePicked = vi.fn();
    render(<Harness onLocated={vi.fn()} onPlacePicked={onPlacePicked} />);

    typeAddress('01 Long');
    fireEvent.click(await screen.findByRole('option', { name: '01 Long Biên, Hà Nội' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Không lấy được vị trí',
        'Invalid or expired place_id',
      ),
    );
    expect(onPlacePicked).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});
