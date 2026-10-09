import type { WarehouseView } from '@modules/facilities/warehouse.view';
import { PlacesService } from './places.service';

const buildWarehouse = (overrides: Partial<WarehouseView> = {}): WarehouseView =>
  ({
    id: 'warehouse-1',
    latitude: 10.78,
    longitude: 106.7,
    ...overrides,
  }) as WarehouseView;

describe('PlacesService', () => {
  let warehouses: { listAvailable: jest.Mock };
  let service: PlacesService;

  beforeEach(() => {
    warehouses = {
      listAvailable: jest.fn().mockResolvedValue([
        buildWarehouse({ id: 'near' }), // ~0.4km from center
        buildWarehouse({ id: 'far', latitude: 21.0285, longitude: 105.8542 }), // Hanoi
      ]),
    };
    service = new PlacesService({ get: jest.fn() } as never, warehouses as never);
  });

  describe('autocomplete', () => {
    afterEach(() => jest.restoreAllMocks());

    const mockGoong = (body: unknown) =>
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true, json: async () => body } as unknown as Response);

    beforeEach(() => {
      service = new PlacesService(
        { get: jest.fn().mockReturnValue('test-key') } as never,
        warehouses as never,
      );
    });

    it('returns an empty list when Goong finds no match', async () => {
      mockGoong({ status: 'ZERO_RESULTS' });

      await expect(service.autocomplete('zzzz không tồn tại')).resolves.toEqual([]);
    });

    it('surfaces 503 when Goong rejects the request', async () => {
      mockGoong({ status: 'REQUEST_DENIED' });

      await expect(service.autocomplete('quận 1')).rejects.toMatchObject({ status: 503 });
    });
  });

  describe('findNearby', () => {
    it('accepts raw lat/lng without calling Goong', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await service.findNearby({ lat: 10.7769, lng: 106.7009, radius: 5 });

      expect(result.center).toEqual({ lat: 10.7769, lng: 106.7009 });
      expect(result.warehouses.map((w) => w.id)).toEqual(['near']);
      expect(result.warehouses[0].distanceKm).toBeLessThan(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects when neither place_id nor a complete lat/lng pair is provided', async () => {
      await expect(service.findNearby({ radius: 5 })).rejects.toMatchObject({ status: 400 });
      await expect(service.findNearby({ lat: 10.7, radius: 5 })).rejects.toMatchObject({
        status: 400,
      });
    });
  });
});
