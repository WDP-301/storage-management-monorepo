import { FacilityOffer, UnitOffer } from '../types/customer';
import { apiClient } from './api';

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
  name: 'Cơ sở Thủ Đức 01',
  address: '12 Võ Văn Ngân, TP. Thủ Đức, TP.HCM',
  distanceKm: 2.4,
};

const quan9 = {
  id: 'facility-q9-02',
  name: 'Cơ sở Quận 9 02',
  address: '88 Lê Văn Việt, Hiệp Phú, TP. Thủ Đức, TP.HCM',
  distanceKm: 4.8,
};

const binhThanh = {
  id: 'facility-bt-03',
  name: 'Cơ sở Bình Thạnh 03',
  address: '124 Nguyễn Xí, Phường 26, Q. Bình Thạnh, TP.HCM',
  distanceKm: 7.6,
};

export const INITIAL_FACILITY_OFFERS: FacilityOffer[] = [
  {
    ...thuDuc,
    units: [
      makeUnit(thuDuc, {
        id: 'td-01-a108',
        code: 'A-108',
        zone: 'Khu A',
        size: '3 m²',
        areaM2: 3,
        volumeM3: 7.2,
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1800000,
        deposit: 1800000,
        features: ['Gần nhau', 'Camera 24/7', 'Điều hòa độ ẩm'],
        status: 'AVAILABLE',
      }),
      makeUnit(thuDuc, {
        id: 'td-01-a109',
        code: 'A-109',
        zone: 'Khu A',
        size: '3 m²',
        areaM2: 3,
        volumeM3: 7.2,
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1800000,
        deposit: 1800000,
        features: ['Liền kề A-108', 'Camera 24/7'],
        status: 'AVAILABLE',
      }),
      makeUnit(thuDuc, {
        id: 'td-01-b204',
        code: 'B-204',
        zone: 'Khu B',
        size: '5 m²',
        areaM2: 5,
        volumeM3: 12.0,
        dimensions: '2 × 2,5 m · cao 2,4 m',
        monthlyPrice: 2750000,
        deposit: 2750000,
        features: ['Gần lối vào', 'Xe tải tiếp cận', 'PCCC tiêu chuẩn'],
        status: 'AVAILABLE',
      }),
      makeUnit(thuDuc, {
        id: 'td-01-b205',
        code: 'B-205',
        zone: 'Khu B',
        size: '10 m²',
        areaM2: 10,
        volumeM3: 28.0,
        dimensions: '2,5 × 4 m · cao 2,8 m',
        monthlyPrice: 4800000,
        deposit: 4800000,
        features: ['Cửa cuốn tự động', 'Xe nâng hỗ trợ', 'Camera 24/7'],
        status: 'AVAILABLE',
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
        areaM2: 3,
        volumeM3: 7.2,
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1650000,
        deposit: 1650000,
        features: ['Cùng khu C', 'Camera 24/7'],
        status: 'AVAILABLE',
      }),
      makeUnit(quan9, {
        id: 'q9-02-c033',
        code: 'C-033',
        zone: 'Khu C',
        size: '5 m²',
        areaM2: 5,
        volumeM3: 12.0,
        dimensions: '2 × 2,5 m · cao 2,4 m',
        monthlyPrice: 2500000,
        deposit: 2500000,
        features: ['Liền kề C-032', 'Xe tải tiếp cận'],
        status: 'AVAILABLE',
      }),
      makeUnit(quan9, {
        id: 'q9-02-c034',
        code: 'C-034',
        zone: 'Khu C',
        size: '5 m²',
        areaM2: 5,
        volumeM3: 12.0,
        dimensions: '2 × 2,5 m · cao 2,4 m',
        monthlyPrice: 2500000,
        deposit: 2500000,
        features: ['Gần thang máy', 'An ninh 3 lớp'],
        status: 'AVAILABLE',
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
        areaM2: 3,
        volumeM3: 7.2,
        dimensions: '1,5 × 2 m · cao 2,4 m',
        monthlyPrice: 1950000,
        deposit: 1950000,
        features: ['Camera 24/7', 'Ra vào 06:00–22:00'],
        status: 'AVAILABLE',
      }),
      makeUnit(binhThanh, {
        id: 'bt-03-d015',
        code: 'D-015',
        zone: 'Khu D',
        size: '5 m²',
        areaM2: 5,
        volumeM3: 12.0,
        dimensions: '2 × 2,5 m · cao 2,4 m',
        monthlyPrice: 2900000,
        deposit: 2900000,
        features: ['Liền kề D-014', 'Bảo hiểm hàng hóa'],
        status: 'AVAILABLE',
      }),
    ],
  },
];

export const formatMoney = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

export const formatDistance = (value: number): string => `${value.toLocaleString('vi-VN')} km`;

/**
 * Service to fetch facilities and units.
 * Defaults to INITIAL_FACILITY_OFFERS; seamlessly fetches from real backend API when available.
 */
export const FacilityApi = {
  getFacilityOffers: async (): Promise<FacilityOffer[]> => {
    try {
      const res = await apiClient.get<{ data: FacilityOffer[] }>('/facilities/browse');
      if (res.data?.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch {
      // Backend endpoint /facilities/browse not implemented yet; fallback to standard mock data
    }
    return INITIAL_FACILITY_OFFERS;
  },
};
