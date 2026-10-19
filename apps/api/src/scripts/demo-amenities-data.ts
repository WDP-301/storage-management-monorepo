/** Amenity catalog seeded for the demo, in display order. */
export const DEMO_AMENITIES = [
  { code: 'AIR_CONDITIONER', name: 'Điều hòa', sortOrder: 10 },
  { code: 'SHELVING', name: 'Kệ chứa đồ', sortOrder: 20 },
  { code: 'CCTV', name: 'Camera giám sát', sortOrder: 30 },
  { code: 'POWER_OUTLET', name: 'Ổ điện', sortOrder: 40 },
  { code: 'LIGHTING', name: 'Đèn chiếu sáng', sortOrder: 50 },
  { code: 'FIRE_EXTINGUISHER', name: 'Bình chữa cháy', sortOrder: 60 },
] as const;

export interface DemoUnitAmenity {
  amenityCode: (typeof DEMO_AMENITIES)[number]['code'];
  quantity: number;
}

/** Equipment per warehouse code; the shelf warehouse carries its shelves' amenities. */
export const DEMO_UNIT_AMENITIES: Record<string, DemoUnitAmenity[]> = {
  'HCM-SG-01': [
    { amenityCode: 'AIR_CONDITIONER', quantity: 1 },
    { amenityCode: 'CCTV', quantity: 1 },
    { amenityCode: 'POWER_OUTLET', quantity: 2 },
  ],
  'HCM-TT-01': [
    { amenityCode: 'SHELVING', quantity: 4 },
    { amenityCode: 'LIGHTING', quantity: 2 },
  ],
  'HN-CG-01': [
    { amenityCode: 'AIR_CONDITIONER', quantity: 2 },
    { amenityCode: 'FIRE_EXTINGUISHER', quantity: 1 },
  ],
  'HCM-KK-02': [
    { amenityCode: 'CCTV', quantity: 6 },
    { amenityCode: 'FIRE_EXTINGUISHER', quantity: 4 },
  ],
};
