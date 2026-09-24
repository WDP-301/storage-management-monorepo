export type CustomerTab = 'browse' | 'bookings' | 'settings';
export type BrowseMode = 'recommended' | 'manual';

export type UnitOffer = {
  id: string;
  facilityId: string;
  facility: string;
  address: string;
  distanceKm: number;
  code: string;
  zone: string;
  size: string;
  dimensions: string;
  monthlyPrice: number;
  deposit: number;
  features: string[];
};

export type FacilityOffer = {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  units: UnitOffer[];
};

export type HeldBooking = {
  id: string;
  units: UnitOffer[];
  startDate: string;
  durationMonths: number;
  holdExpiresAt: number;
};
