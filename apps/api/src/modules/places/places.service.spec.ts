import { Facility } from '@entities/facility.entity';
import { PlacesService } from './places.service';

const buildFacility = (overrides: Partial<Facility> = {}): Facility =>
  ({
    id: 'facility-1',
    latitude: 10.78,
    longitude: 106.7,
    ...overrides,
  }) as Facility;

describe('PlacesService', () => {
  let facilitiesService: { findAll: jest.Mock };
  let service: PlacesService;

  beforeEach(() => {
    facilitiesService = {
      findAll: jest.fn().mockResolvedValue([
        buildFacility({ id: 'near' }), // ~0.4km from center
        buildFacility({ id: 'far', latitude: 21.0285, longitude: 105.8542 }), // Hanoi
      ]),
    };
    service = new PlacesService({ get: jest.fn() } as never, facilitiesService as never);
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
        facilitiesService as never,
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
      expect(result.facilities.map((f) => f.id)).toEqual(['near']);
      expect(result.facilities[0].distanceKm).toBeLessThan(1);
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
