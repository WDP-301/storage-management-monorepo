import type { FacilityOffer, UnitOffer } from '../types/customer';

const makeUnit = (
  facility: Omit<FacilityOffer, 'units'>,
  unit: Omit<UnitOffer, 'facilityId' | 'facility' | 'address' | 'distanceKm'>,
): UnitOffer => ({
  ...unit,
  facilityId: facility.id,
  facility: facility.name,
  address: facility.address,
  distanceKm: facility.distanceKm,
});

const thuDuc = {
  id: 'facility-td-01',
  name: 'Thủ Đức 01',
  address: '12 Võ Văn Ngân, TP. Thủ Đức',
  distanceKm: 2.4,
};

const quan9 = {
  id: 'facility-q9-02',
  name: 'Quận 9 02',
  address: '88 Lê Văn Việt, TP. Thủ Đức',
  distanceKm: 4.8,
};

const binhThanh = {
  id: 'facility-bt-03',
  name: 'Bình Thạnh 03',
  address: '124 Nguyễn Xí, Q. Bình Thạnh, TP.HCM',
  distanceKm: 7.6,
};

export const facilityOffers: FacilityOffer[] = [
  {
    ...thuDuc,
    units: [
      makeUnit(thuDuc, {
        id: 'td-01-a108',
        code: 'A-108',
        zone: 'Khu A',
        size: '3 m²',
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1800000,
        deposit: 1800000,
        features: ['Gần nhau', 'Camera 24/7'],
      }),
      makeUnit(thuDuc, {
        id: 'td-01-a109',
        code: 'A-109',
        zone: 'Khu A',
        size: '3 m²',
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1800000,
        deposit: 1800000,
        features: ['Liền kề A-108', 'Camera 24/7'],
      }),
      makeUnit(thuDuc, {
        id: 'td-01-b204',
        code: 'B-204',
        zone: 'Khu B',
        size: '5 m²',
        dimensions: '2 × 2,5 m · cao 2,4 m',
        monthlyPrice: 2750000,
        deposit: 2750000,
        features: ['Gần lối vào', 'Xe tải tiếp cận'],
      }),
    ],
  },
  {
    ...quan9,
    units: [
      makeUnit(quan9, {
        id: 'q9-02-c032',
        code: 'C-032',
        zone: 'Khu C',
        size: '3 m²',
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1650000,
        deposit: 1650000,
        features: ['Cùng khu C', 'Camera 24/7'],
      }),
      makeUnit(quan9, {
        id: 'q9-02-c033',
        code: 'C-033',
        zone: 'Khu C',
        size: '5 m²',
        dimensions: '2 × 2,5 m · cao 2,4 m',
        monthlyPrice: 2500000,
        deposit: 2500000,
        features: ['Liền kề C-032', 'Xe tải tiếp cận'],
      }),
    ],
  },
  {
    ...binhThanh,
    units: [
      makeUnit(binhThanh, {
        id: 'bt-03-d014',
        code: 'D-014',
        zone: 'Khu D',
        size: '3 m²',
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1950000,
        deposit: 1950000,
        features: ['Camera 24/7', 'Ra vào 06:00–22:00'],
      }),
    ],
  },
];

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

export const formatDistance = (value: number) => `${value.toLocaleString('vi-VN')} km`;
