import type { WarehouseView } from '@modules/facilities/warehouse.view';
import { WarehouseQueryService } from '@modules/facilities/warehouse-query.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEY, GOONG_BASE_URL, GOONG_DEFAULT_LOCATION } from '@shared/constants';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { NearbyQueryDto } from './dto/places-query.dto';

export interface NearbyWarehouse extends WarehouseView {
  distanceKm: number;
}

export interface ResolvedPlace {
  placeId: string;
  address: string | null;
  lat: number;
  lng: number;
}

export interface NearbyResult {
  center: { lat: number; lng: number };
  warehouses: NearbyWarehouse[];
}

@Injectable()
export class PlacesService {
  /** Simple in-memory cache: input → { predictions, expiresAt } */
  private readonly autocompleteCache = new Map<string, { data: any[]; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds

  constructor(
    private readonly config: ConfigService,
    private readonly warehouses: WarehouseQueryService,
  ) {}

  private get apiKey(): string {
    const key = this.config.get<string>(ENV_KEY.GOONG_API_KEY);
    if (!key) {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Goong API key is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return key;
  }

  // ─── Autocomplete ──────────────────────────────────────────────────────────

  async autocomplete(input: string): Promise<any[]> {
    // Return from cache if still fresh
    const cached = this.autocompleteCache.get(input);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const params = new URLSearchParams({
      api_key: this.apiKey,
      input,
      more_compound: 'true',
      limit: '10',
      radius: '100',
      location: GOONG_DEFAULT_LOCATION,
    });
    const url = `${GOONG_BASE_URL}/place/autocomplete?${params.toString()}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Goong service is unreachable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!res.ok) {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Goong autocomplete request failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const json = await res.json();
    // Goong signals business errors via json.status, not HTTP status
    // (e.g. REQUEST_DENIED on quota exceeded returns 200 with no predictions).
    // ZERO_RESULTS is a normal "no match" answer, not an outage.
    if (json?.status !== 'OK' && json?.status !== 'ZERO_RESULTS') {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        `Goong autocomplete failed: ${json?.status ?? 'unknown'}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const predictions: any[] = json?.predictions ?? [];

    this.autocompleteCache.set(input, {
      data: predictions,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return predictions;
  }

  async findNearby(query: NearbyQueryDto): Promise<NearbyResult> {
    const location = await this.resolveCenter(query);

    const nearby: NearbyWarehouse[] = (await this.warehouses.listAvailable())
      .map((warehouse) => ({
        ...warehouse,
        distanceKm: this.haversine(
          location.lat,
          location.lng,
          warehouse.latitude,
          warehouse.longitude,
        ),
      }))
      .filter((warehouse) => warehouse.distanceKm <= query.radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return { center: location, warehouses: nearby };
  }

  async resolvePlace(placeId: string): Promise<ResolvedPlace> {
    const detail = await this.getPlaceDetail(placeId);
    const location = this.extractLocation(detail);
    return {
      placeId,
      address: detail?.result?.formatted_address ?? null,
      lat: location.lat,
      lng: location.lng,
    };
  }

  private async resolveCenter(query: NearbyQueryDto): Promise<{ lat: number; lng: number }> {
    if (query.lat !== undefined && query.lng !== undefined) {
      return { lat: query.lat, lng: query.lng };
    }
    if (!query.place_id) {
      throw new DomainException(
        ErrorCode.BAD_REQUEST,
        'Provide either place_id or both lat and lng',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.extractLocation(await this.getPlaceDetail(query.place_id));
  }

  private extractLocation(detail: any): { lat: number; lng: number } {
    const location: { lat: number; lng: number } = detail?.result?.geometry?.location;

    if (!location?.lat || !location?.lng) {
      throw new DomainException(
        ErrorCode.BAD_REQUEST,
        'Place has no resolvable coordinates',
        HttpStatus.BAD_REQUEST,
      );
    }
    return location;
  }

  private async getPlaceDetail(placeId: string): Promise<any> {
    const url = `${GOONG_BASE_URL}/place/detail?api_key=${this.apiKey}&place_id=${encodeURIComponent(placeId)}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Goong service is unreachable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!res.ok) {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Goong place detail request failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const json = await res.json();
    if (json?.status !== 'OK') {
      throw new DomainException(
        ErrorCode.BAD_REQUEST,
        'Invalid or expired place_id',
        HttpStatus.BAD_REQUEST,
      );
    }

    return json;
  }

  /**
   * Haversine formula — returns great-circle distance in km between two
   * points on Earth identified by their latitude/longitude in decimal degrees.
   */
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
