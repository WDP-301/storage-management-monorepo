import { StorageUnitStatus, UserRole } from '@storage/types';

/** Demo account password on a local database; remote targets must supply DEMO_PASSWORD. */
export const DEMO_PASSWORD = 'Demo1234!';

export interface DemoAccount {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  /** Facility-scoped roles are granted on each of these facilities (by code). */
  facilityCodes?: string[];
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'admin@demo.vn',
    fullName: 'Quản trị Demo',
    phone: '0900000001',
    role: UserRole.ADMIN,
  },
  {
    email: 'ops@demo.vn',
    fullName: 'Vận hành Demo',
    phone: '0900000002',
    role: UserRole.OPERATIONS_MANAGER,
  },
  {
    email: 'manager@demo.vn',
    fullName: 'Quản lý kho Demo',
    phone: '0900000003',
    role: UserRole.FACILITY_MANAGER,
    facilityCodes: ['CN-HCM'],
  },
  {
    email: 'staff@demo.vn',
    fullName: 'Nhân viên kho Demo',
    phone: '0900000004',
    role: UserRole.FACILITY_STAFF,
    facilityCodes: ['CN-HCM'],
  },
  {
    email: 'customer@demo.vn',
    fullName: 'Khách hàng Demo',
    phone: '0900000005',
    role: UserRole.CUSTOMER,
  },
];

export interface DemoFacility {
  code: string;
  name: string;
  /** Optional region; informational, not enforced against the warehouses' own provinces. */
  provinceCode: string;
}

/** Branches (cơ sở) that own the demo warehouses. */
export const DEMO_FACILITIES: DemoFacility[] = [
  { code: 'CN-HCM', name: 'Cơ sở Hồ Chí Minh', provinceCode: '79' },
  { code: 'CN-HN', name: 'Cơ sở Hà Nội', provinceCode: '01' },
  { code: 'CN-DN', name: 'Cơ sở Đà Nẵng', provinceCode: '48' },
];

export interface DemoWarehouse {
  /** Code of the owning entry in DEMO_FACILITIES. */
  facilityCode: string;
  code: string;
  name: string;
  addressLine: string;
  wardCode: string;
  latitude: number;
  longitude: number;
  widthM: number;
  lengthM: number;
  heightM: number;
  monthlyPrice: number;
  depositMonths: number | null;
  notes: string;
  status?: StorageUnitStatus;
}

/** Each warehouse's province is derived from its ward (post-2025 two-level model). */
export const DEMO_WAREHOUSES: DemoWarehouse[] = [
  {
    code: 'HCM-SG-01',
    facilityCode: 'CN-HCM',
    name: 'Kho mini Sài Gòn 12m²',
    addressLine: '45 Lê Thánh Tôn',
    wardCode: '26740',
    latitude: 10.7769,
    longitude: 106.7032,
    widthM: 3,
    lengthM: 4,
    heightM: 2.8,
    monthlyPrice: 3_200_000,
    depositMonths: null,
    notes: 'Gần trung tâm, ra vào bằng thang máy hàng',
  },
  {
    code: 'HCM-TT-01',
    facilityCode: 'CN-HCM',
    name: 'Kho Tân Thuận 40m²',
    addressLine: '18 Nguyễn Văn Linh',
    wardCode: '27478',
    latitude: 10.7425,
    longitude: 106.7213,
    widthM: 5,
    lengthM: 8,
    heightM: 3.5,
    monthlyPrice: 6_500_000,
    depositMonths: 2,
    notes: 'Cửa cuốn 3m, xe tải nhỏ vào tận cửa',
  },
  {
    code: 'HCM-TD-01',
    facilityCode: 'CN-HCM',
    name: 'Kho xưởng Thủ Đức 120m²',
    addressLine: '210 Xa lộ Hà Nội',
    wardCode: '26824',
    latitude: 10.8491,
    longitude: 106.7717,
    widthM: 10,
    lengthM: 12,
    heightM: 6,
    monthlyPrice: 18_000_000,
    depositMonths: 3,
    notes: 'Có xe nâng, nền chịu tải 2 tấn/m²',
  },
  {
    code: 'HCM-GV-01',
    facilityCode: 'CN-HCM',
    name: 'Kho Gò Vấp 20m²',
    addressLine: '77 Quang Trung',
    wardCode: '26884',
    latitude: 10.8386,
    longitude: 106.6653,
    widthM: 4,
    lengthM: 5,
    heightM: 3,
    monthlyPrice: 3_800_000,
    depositMonths: null,
    notes: 'Khu dân cư, phù hợp đồ gia đình',
  },
  {
    code: 'HCM-TSN-01',
    facilityCode: 'CN-HCM',
    name: 'Kho Tân Sơn Nhất 30m²',
    addressLine: '5 Trường Sơn',
    wardCode: '26968',
    latitude: 10.8013,
    longitude: 106.6647,
    widthM: 5,
    lengthM: 6,
    heightM: 3.2,
    monthlyPrice: 5_200_000,
    depositMonths: null,
    notes: 'Gần sân bay, tiện kho hàng thương mại điện tử',
  },
  {
    code: 'HCM-BT-01',
    facilityCode: 'CN-HCM',
    name: 'Kho Bình Tân 80m²',
    addressLine: '350 Kinh Dương Vương',
    wardCode: '27442',
    latitude: 10.7503,
    longitude: 106.6188,
    widthM: 8,
    lengthM: 10,
    heightM: 5,
    monthlyPrice: 11_000_000,
    depositMonths: 2,
    notes: 'Bãi đậu container 20ft',
  },
  {
    code: 'HCM-BC-01',
    facilityCode: 'CN-HCM',
    name: 'Kho Bình Chánh 200m²',
    addressLine: 'Lô B2 KCN Vĩnh Lộc',
    wardCode: '27637',
    latitude: 10.7181,
    longitude: 106.6042,
    widthM: 10,
    lengthM: 20,
    heightM: 7,
    monthlyPrice: 26_000_000,
    depositMonths: 3,
    notes: 'Kho khung thép, PCCC đạt chuẩn',
    status: StorageUnitStatus.MAINTENANCE,
  },
  {
    code: 'BD-TDM-01',
    facilityCode: 'CN-HCM',
    name: 'Kho Thủ Dầu Một 60m²',
    addressLine: '12 Đại lộ Bình Dương',
    wardCode: '25747',
    latitude: 10.9804,
    longitude: 106.6519,
    widthM: 6,
    lengthM: 10,
    heightM: 4.5,
    monthlyPrice: 7_000_000,
    depositMonths: null,
    notes: 'Gần QL13, xe container ra vào được',
  },
  {
    code: 'BD-DA-01',
    facilityCode: 'CN-HCM',
    name: 'Kho Dĩ An 25m²',
    addressLine: '88 Nguyễn An Ninh',
    wardCode: '25942',
    latitude: 10.9068,
    longitude: 106.7697,
    widthM: 5,
    lengthM: 5,
    heightM: 3,
    monthlyPrice: 3_500_000,
    depositMonths: null,
    notes: 'Có camera 24/7',
  },
  {
    code: 'HN-CG-01',
    facilityCode: 'CN-HN',
    name: 'Kho Cầu Giấy 15m²',
    addressLine: '102 Trần Duy Hưng',
    wardCode: '00166',
    latitude: 21.0097,
    longitude: 105.8003,
    widthM: 3,
    lengthM: 5,
    heightM: 2.8,
    monthlyPrice: 3_000_000,
    depositMonths: null,
    notes: 'Tầng trệt, ô tô đỗ cửa',
  },
  {
    code: 'HN-LB-01',
    facilityCode: 'CN-HN',
    name: 'Kho Long Biên 100m²',
    addressLine: '25 Nguyễn Văn Cừ',
    wardCode: '00145',
    latitude: 21.0451,
    longitude: 105.8724,
    widthM: 10,
    lengthM: 10,
    heightM: 5.5,
    monthlyPrice: 14_000_000,
    depositMonths: 2,
    notes: 'Gần cầu Chương Dương',
  },
  {
    code: 'DN-HC-01',
    facilityCode: 'CN-DN',
    name: 'Kho Hải Châu 35m²',
    addressLine: '60 Nguyễn Văn Linh',
    wardCode: '20242',
    latitude: 16.0605,
    longitude: 108.2112,
    widthM: 5,
    lengthM: 7,
    heightM: 3.5,
    monthlyPrice: 5_000_000,
    depositMonths: null,
    notes: 'Gần sân bay Đà Nẵng',
  },
];
