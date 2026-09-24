export type BrowseMode = 'recommended' | 'manual';

export interface UnitOffer {
  id: string;
  facilityId: string;
  facility: string;
  address: string;
  distanceKm: number;
  code: string;
  zone: string;
  size: string;
  areaM2?: number;
  volumeM3?: number;
  dimensions: string;
  monthlyPrice: number;
  deposit: number;
  features: string[];
  status?: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
}

export interface FacilityOffer {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  units: UnitOffer[];
}

export interface HeldBooking {
  id: string;
  units: UnitOffer[];
  startDate: string;
  durationMonths: number;
  holdExpiresAt: number;
}

export interface UnitFilterOptions {
  searchQuery: string;
  sizeFilter: string; // 'all' | '3' | '5' | '10'
  maxPrice: number;
  requestedQuantity: number;
}
