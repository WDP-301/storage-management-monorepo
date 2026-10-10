import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeMap, FakeMarker, pointFeature } from '../../test-utils/fake-maplibre';
import type { Warehouse } from '../../types/warehouse';
import { WarehouseOverviewMap } from './WarehouseOverviewMap';

const goong = vi.hoisted(() => ({
  map: null as unknown,
  error: null as string | null,
  styleUrl: '',
}));

// The tiles key comes from the build env; tests must not depend on a local .env.
vi.mock('./goong-map', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./goong-map')>();
  return {
    ...actual,
    get GOONG_STYLE_URL() {
      return goong.styleUrl;
    },
  };
});

vi.mock('./useGoongMap', () => ({
  useGoongMap: () => ({ containerRef: { current: null }, map: goong.map, error: goong.error }),
}));
vi.mock('maplibre-gl', async () => ({
  Marker: (await import('../../test-utils/fake-maplibre')).FakeMarker,
}));

const wh = (id: string, over: Partial<Warehouse> = {}): Warehouse =>
  ({
    id,
    code: id.toUpperCase(),
    name: `Kho ${id}`,
    addressLine: `Địa chỉ ${id}`,
    facility: { id: 'fac-1', code: 'CN-HCM', name: 'Chi nhánh Hồ Chí Minh' },
    latitude: 10.77,
    longitude: 106.7,
    status: 'AVAILABLE',
    ...over,
  }) as Warehouse;

const SG = wh('sg-01');
const TD = wh('td-01', { latitude: 10.85, longitude: 106.77, status: 'RENTED' });
const NO_COORDS = wh('nc-01', { latitude: 0, longitude: 0, status: 'MAINTENANCE' });

const actions = (w: Warehouse) => <button type="button">{`Thao tác ${w.code}`}</button>;

describe('WarehouseOverviewMap', () => {
  let map: FakeMap;

  beforeEach(() => {
    map = new FakeMap();
    goong.map = map;
    goong.error = null;
    goong.styleUrl = 'https://tiles.example/style.json';
    FakeMarker.instances = [];
  });

  afterEach(() => map.destroy());

  const renderMap = (props: Partial<ComponentProps<typeof WarehouseOverviewMap>> = {}) =>
    render(
      <WarehouseOverviewMap
        warehouses={[SG, TD, NO_COORDS]}
        visible
        focusedWarehouseId={null}
        renderActions={actions}
        {...props}
      />,
    );

  it('counts plottable warehouses and lists them per status in the legend', () => {
    renderMap();
    expect(screen.getByText('2/3 kho có tọa độ')).toBeTruthy();

    const legend = screen.getByRole('list', { name: 'Chú thích màu trạng thái kho' });
    const rows = within(legend)
      .getAllByRole('listitem')
      .map((row) => row.textContent);
    // The warehouse without coordinates is not on the map, so it is not counted.
    expect(rows).toEqual([
      'Còn trống1',
      'Đã cọc0',
      'Đang thuê1',
      'Giữ chỗ / chờ kiểm tra0',
      'Bảo trì0',
      'Ngưng hoạt động0',
    ]);
  });

  it('fits the camera to every warehouse when nothing is selected', () => {
    renderMap();
    expect(map.resize).toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it('opens the focused warehouse with role actions and flies to it', async () => {
    renderMap({ focusedWarehouseId: 'td-01' });

    const card = screen
      .getByRole('heading', { name: 'Kho td-01' })
      .closest('div.absolute') as HTMLElement;
    expect(within(card).getByText('TD-01 · Chi nhánh Hồ Chí Minh')).toBeTruthy();
    expect(within(card).getByText('Đang thuê')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thao tác TD-01' })).toBeTruthy();
    await waitFor(() =>
      expect(map.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({ center: [106.77, 10.85], zoom: 15 }),
      ),
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('selects a warehouse from its pin and closes the card', async () => {
    renderMap();
    await waitFor(() => expect(map.listenerCount('render')).toBe(1));
    map.showFeatures([pointFeature('sg-01', [106.7, 10.77])]);

    fireEvent.click(screen.getByRole('button', { name: 'Xem kho SG-01 trên bản đồ' }));
    expect(screen.getByRole('heading', { name: 'Kho sg-01' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông tin kho' }));
    expect(screen.queryByRole('heading', { name: 'Kho sg-01' })).toBeNull();
  });

  it('keeps the selection through a reload but hides actions until fresh data arrives', () => {
    const { rerender } = renderMap({ focusedWarehouseId: 'sg-01' });
    const reload = (warehouses: Warehouse[], isLoading: boolean) =>
      rerender(
        <WarehouseOverviewMap
          warehouses={warehouses}
          isLoading={isLoading}
          visible
          focusedWarehouseId="sg-01"
          renderActions={actions}
        />,
      );

    reload([SG, TD], true);
    expect(screen.getByText('Đang tải vị trí kho...')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kho sg-01' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thao tác SG-01' })).toBeNull();

    reload([SG, TD], false);
    expect(screen.getByRole('button', { name: 'Thao tác SG-01' })).toBeTruthy();
    // The selected warehouse keeps the camera after the refetch.
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('keeps the selection while a reload briefly empties the list', () => {
    const { rerender } = renderMap({ focusedWarehouseId: 'sg-01' });
    const reload = (warehouses: Warehouse[], isLoading: boolean) =>
      rerender(
        <WarehouseOverviewMap
          warehouses={warehouses}
          isLoading={isLoading}
          visible
          focusedWarehouseId="sg-01"
          renderActions={actions}
        />,
      );

    reload([], true);
    expect(screen.queryByRole('heading', { name: 'Kho sg-01' })).toBeNull();
    reload([SG, TD], false);
    expect(screen.getByRole('heading', { name: 'Kho sg-01' })).toBeTruthy();
  });

  it('drops the selection once loaded data no longer contains the warehouse', () => {
    const { rerender } = renderMap({ focusedWarehouseId: 'sg-01' });
    const reload = (warehouses: Warehouse[]) =>
      rerender(
        <WarehouseOverviewMap
          warehouses={warehouses}
          visible
          focusedWarehouseId="sg-01"
          renderActions={actions}
        />,
      );

    reload([TD]);
    expect(map.fitBounds).toHaveBeenCalled();
    // Coming back does not resurrect it: the selection was cleared, not just hidden.
    reload([SG, TD]);
    expect(screen.queryByRole('heading', { name: 'Kho sg-01' })).toBeNull();
  });

  it('does not move the camera while hidden', () => {
    renderMap({ visible: false, focusedWarehouseId: 'sg-01' });
    expect(map.resize).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it('explains when no warehouse can be plotted', () => {
    renderMap({ warehouses: [NO_COORDS] });
    expect(screen.getByText('0/1 kho có tọa độ')).toBeTruthy();
    expect(screen.getByText('Không có kho nào có tọa độ hợp lệ.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Chú thích màu trạng thái kho' })).toBeNull();
  });

  it('asks for the tiles key when the build has none', () => {
    goong.styleUrl = '';
    renderMap();
    expect(screen.getByRole('alert').textContent).toBe(
      'Chưa cấu hình VITE_GOONG_MAPTILES_KEY cho web.',
    );
    expect(screen.queryByRole('region', { name: 'Bản đồ vị trí kho' })).toBeNull();
  });

  it('shows the map loading error instead of the map', () => {
    goong.error = 'Không tải được bản đồ Goong.';
    renderMap();
    expect(screen.getByRole('alert').textContent).toBe('Không tải được bản đồ Goong.');
    expect(screen.queryByRole('region', { name: 'Bản đồ vị trí kho' })).toBeNull();
  });
});
