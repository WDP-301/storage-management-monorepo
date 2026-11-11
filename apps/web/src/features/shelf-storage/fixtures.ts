import type { ShelfReceiptView, WarehouseShelfStockView } from '@storage/types';

export const receiptFixture = (over: Partial<ShelfReceiptView> = {}): ShelfReceiptView => ({
  id: 'r1',
  code: 'PG-20261107-AAAA1111',
  type: 'DROP_OFF',
  status: 'ACTIVE',
  contractId: 'c1',
  contractNo: 'HD-001',
  shelf: { id: 's1', code: 'K-01', name: 'Kệ 01' },
  warehouse: { id: 'w1', code: 'KK-02', name: 'Kho kệ 2' },
  facility: { id: 'f1', code: 'HCM', name: 'Chi nhánh HCM' },
  customer: { id: 'u1', fullName: 'Nguyễn An', phone: '0900000001' },
  performedBy: { id: 'st1', fullName: 'Nhân viên Bình' },
  createdAt: '2026-11-07T03:00:00.000Z',
  note: null,
  photos: [],
  lines: [{ itemId: 'i1', name: 'Thùng sách', quantity: 3 }],
  pickupRequestId: null,
  dropOffRequestId: null,
  recovered: false,
  void: null,
  openDisputeTicket: null,
  ...over,
});

export const stockFixture = (
  over: Partial<WarehouseShelfStockView> = {},
): WarehouseShelfStockView => ({
  contractId: 'c1',
  contractNo: 'HD-001',
  contractStatus: 'ACTIVE',
  effectiveAt: '2026-10-01T00:00:00.000Z',
  shelf: { id: 's1', code: 'K-01', name: 'Kệ 01' },
  customer: { id: 'u1', fullName: 'Nguyễn An', phone: '0900000001' },
  returnOpen: false,
  items: [{ id: 'i1', name: 'Thùng sách', quantity: 3, updatedAt: '2026-11-07T03:00:00.000Z' }],
  totalQuantity: 3,
  openRequest: null,
  ...over,
});
