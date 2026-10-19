import type { LayoutElement, LayoutRect } from '@entities/shelf-layout.entity';
import { LayoutElementType, StorageUnitStatus } from '@storage/types';

const { AISLE, DOOR, LABEL, OBSTACLE } = LayoutElementType;

/** Every shelf with this code prefix shares one size and price. */
export interface DemoShelfZone {
  prefix: string;
  widthM: number;
  lengthM: number;
  heightM: number;
  monthlyPrice: number;
  /** Floor cells of `<prefix>-01`, `<prefix>-02`… in numbering order. */
  rects: LayoutRect[];
}

export const DEMO_SHELF_WAREHOUSE = {
  facilityCode: 'CN-HCM',
  code: 'HCM-KK-02',
  name: 'Kho kệ Tân Bình',
  addressLine: '18 Cộng Hòa',
  wardCode: '27004',
  latitude: 10.8016,
  longitude: 106.6527,
  widthM: 20,
  lengthM: 30,
  heightM: 6,
  depositMonths: 1,
  notes: 'Kho kệ nhiều khu: kệ mini, kệ đôi, pallet, kệ đứng cao, tủ khóa, kệ dài và kệ ngoại cỡ.',
};

/** `count` shelves of `rowSpan` x `colSpan` side by side from (row, col), rightwards or downwards. */
function run(
  row: number,
  col: number,
  count: number,
  [rowSpan, colSpan]: [number, number],
  down = false,
): LayoutRect[] {
  return Array.from({ length: count }, (_, index) => ({
    row: down ? row + index * rowSpan : row,
    col: down ? col : col + index * colSpan,
    rowSpan,
    colSpan,
  }));
}

function element(
  type: LayoutElementType,
  [row, col, rowSpan, colSpan]: [number, number, number, number],
  text?: string,
): LayoutElement {
  return { type, row, col, rowSpan, colSpan, ...(text ? { text } : {}) };
}

/** A blocking item with its caption on the top-left cell, where the editor prints label text. */
function captioned(
  type: LayoutElementType,
  rect: [number, number, number, number],
  text: string,
): LayoutElement[] {
  const [row, col] = rect;
  return [element(type, rect), element(LABEL, [row, col, 1, 1], text)];
}

const MINI = [1, 1] as [number, number];

/**
 * A 20 x 30 floor: two main aisles cross the hall into four shelf blocks, a walkway runs along
 * the front, and the service strip (office, entrance, loading dock) fills the bottom three rows.
 */
export const DEMO_SHELF_ZONES: DemoShelfZone[] = [
  {
    prefix: 'A', // kệ mini, three rows in the top-left block
    widthM: 1,
    lengthM: 0.6,
    heightM: 2,
    monthlyPrice: 350_000,
    rects: [
      ...run(0, 4, 10, MINI),
      ...[2, 3].flatMap((row) => [...run(row, 0, 6, MINI), ...run(row, 7, 7, MINI)]),
    ],
  },
  {
    prefix: 'B', // kệ đôi, back to back on either side of a pillar
    widthM: 2,
    lengthM: 0.6,
    heightM: 2,
    monthlyPrice: 650_000,
    rects: [5, 6].flatMap((row) => [...run(row, 2, 2, [1, 2]), ...run(row, 7, 3, [1, 2])]),
  },
  {
    prefix: 'C', // pallet racks around the freight lift
    widthM: 2.4,
    lengthM: 1.2,
    heightM: 4.5,
    monthlyPrice: 1_800_000,
    rects: [
      ...run(0, 18, 6, [2, 2]),
      ...[3, 5].flatMap((row) => [...run(row, 16, 3, [2, 2]), ...run(row, 24, 3, [2, 2])]),
    ],
  },
  {
    prefix: 'D', // tall racks in columns, reached from the vertical aisles
    widthM: 0.8,
    lengthM: 1.6,
    heightM: 3,
    monthlyPrice: 750_000,
    rects: [0, 2, 3, 5, 6, 8, 9].flatMap((col) => run(10, col, 3, [2, 1], true)),
  },
  {
    prefix: 'E', // lockers next to the main aisle
    widthM: 0.6,
    lengthM: 0.6,
    heightM: 1.8,
    monthlyPrice: 450_000,
    rects: [11, 12].flatMap((col) => run(10, col, 6, MINI, true)),
  },
  {
    prefix: 'F', // long-span shelving
    widthM: 3,
    lengthM: 0.8,
    heightM: 2.4,
    monthlyPrice: 950_000,
    rects: [...run(9, 21, 3, [1, 3]), ...run(11, 16, 4, [1, 3]), ...run(12, 16, 4, [1, 3])],
  },
  {
    prefix: 'G', // oversized bays facing the front walkway
    widthM: 3,
    lengthM: 2,
    heightM: 3,
    monthlyPrice: 2_200_000,
    rects: run(14, 16, 4, [2, 3]),
  },
];

/** Shelves that do not start AVAILABLE, keyed by `<prefix>-<number>`. */
export const DEMO_SHELF_STATUS: Record<string, { status: StorageUnitStatus; notes: string }> = {
  'A-15': { status: StorageUnitStatus.MAINTENANCE, notes: 'Đang thay thanh đỡ tầng 2' },
  'B-04': { status: StorageUnitStatus.MAINTENANCE, notes: 'Chờ sửa khóa' },
  'C-08': { status: StorageUnitStatus.MAINTENANCE, notes: 'Kiểm định tải trọng' },
  'D-11': { status: StorageUnitStatus.MAINTENANCE, notes: 'Cân chỉnh chân kệ' },
  'E-12': { status: StorageUnitStatus.INACTIVE, notes: 'Tạm ngưng cho thuê' },
  'F-11': { status: StorageUnitStatus.INACTIVE, notes: 'Dành cho hàng nội bộ' },
};

export const DEMO_SHELF_LAYOUT: { rows: number; cols: number; elements: LayoutElement[] } = {
  rows: 20,
  cols: 30,
  elements: [
    // Main aisles, exits and the front walkway.
    ...captioned(DOOR, [0, 14, 1, 2], 'Thoát hiểm'),
    element(AISLE, [1, 14, 6, 2]),
    element(AISLE, [7, 0, 2, 29]),
    ...captioned(DOOR, [7, 29, 2, 1], 'Thoát hiểm'),
    element(AISLE, [9, 13, 7, 3]),
    element(AISLE, [16, 0, 1, 30]),
    // Top-left block: A and B.
    element(LABEL, [0, 0, 1, 4], 'Khu A · Kệ mini'),
    element(AISLE, [1, 0, 1, 14]),
    element(AISLE, [4, 0, 1, 14]),
    ...captioned(OBSTACLE, [2, 6, 2, 1], 'Cột'),
    element(LABEL, [5, 0, 2, 2], 'Khu B · Kệ đôi'),
    ...captioned(OBSTACLE, [5, 6, 2, 1], 'Cột'),
    ...captioned(OBSTACLE, [5, 13, 2, 1], 'PCCC'),
    // Top-right block: C.
    element(LABEL, [0, 16, 2, 2], 'Khu C · Pallet'),
    element(AISLE, [2, 16, 1, 14]),
    ...captioned(OBSTACLE, [3, 22, 4, 2], 'Thang hàng'),
    // Bottom-left block: D and E.
    element(LABEL, [9, 0, 1, 10], 'Khu D · Kệ đứng cao'),
    element(LABEL, [9, 10, 1, 3], 'Khu E · Tủ khóa'),
    ...[1, 4, 7, 10].map((col) => element(AISLE, [10, col, 6, 1])),
    // Bottom-right block: F and G.
    element(LABEL, [9, 16, 1, 5], 'Khu F · Kệ dài'),
    element(AISLE, [10, 16, 1, 14]),
    ...captioned(OBSTACLE, [11, 28, 2, 2], 'Tủ điện'),
    element(AISLE, [13, 16, 1, 14]),
    element(LABEL, [14, 28, 2, 2], 'Khu G · Ngoại cỡ'),
    // Service strip.
    ...captioned(OBSTACLE, [17, 0, 3, 4], 'Văn phòng'),
    ...captioned(OBSTACLE, [17, 4, 3, 2], 'WC'),
    ...captioned(OBSTACLE, [17, 6, 1, 3], 'Quầy lễ tân'),
    element(LABEL, [18, 6, 2, 3], 'Sảnh chờ'),
    element(LABEL, [17, 9, 2, 5], 'Sảnh · Check-in QR'),
    ...captioned(DOOR, [19, 9, 1, 5], 'Cổng chính'),
    ...captioned(OBSTACLE, [17, 14, 3, 2], 'Cầu thang'),
    element(LABEL, [17, 16, 2, 8], 'Khu tập kết hàng'),
    ...captioned(DOOR, [19, 16, 1, 8], 'Cửa bốc xếp'),
    ...captioned(OBSTACLE, [17, 24, 3, 3], 'Bãi xe nâng'),
    ...captioned(OBSTACLE, [17, 27, 3, 3], 'Phòng kỹ thuật'),
  ],
};
