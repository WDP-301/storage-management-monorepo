import type { ShelfReceiptView } from '@storage/types';
import { receiptNotice, voidedNotice } from './shelf-notifications';

const receipt = (over: Partial<ShelfReceiptView> = {}): ShelfReceiptView =>
  ({
    id: 'r-1',
    code: 'PG-20261107-AAAAAAAA',
    type: 'DROP_OFF',
    contractId: 'c-1',
    shelf: { id: 's-1', code: 'K-1', name: 'Kệ 1' },
    recovered: false,
    lines: [
      { itemId: 'i-1', name: 'Sách', quantity: 2 },
      { itemId: 'i-2', name: 'Chăn', quantity: 1 },
    ],
    ...over,
  }) as ShelfReceiptView;
const data = { contractId: 'c-1', receiptId: 'r-1', receiptCode: 'PG-20261107-AAAAAAAA' };

describe('shelf notifications', () => {
  it('announces a drop-off', () => {
    expect(receiptNotice(receipt())).toEqual({
      type: 'SHELF_DROP_OFF',
      title: 'Đã nhận đồ gửi',
      body: 'Phiếu PG-20261107-AAAAAAAA · kệ K-1: Sách ×2, Chăn ×1',
      data,
    });
  });

  it('announces a pick-up', () => {
    expect(receiptNotice(receipt({ type: 'PICK_UP' }))).toMatchObject({
      type: 'SHELF_PICK_UP',
      title: 'Đã trả đồ',
      body: 'Phiếu PG-20261107-AAAAAAAA · kệ K-1: Sách ×2, Chăn ×1',
      data,
    });
  });

  it('uses the recovery wording for a scan-less pick-up', () => {
    expect(receiptNotice(receipt({ type: 'PICK_UP', recovered: true }))).toMatchObject({
      type: 'SHELF_PICK_UP',
      title: 'Đã thu hồi đồ trên kệ',
      body: 'Kệ K-1 được trả theo yêu cầu thu hồi; phiếu PG-20261107-AAAAAAAA: Sách ×2, Chăn ×1',
    });
  });

  it('shortens long item lists', () => {
    const lines = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({
      itemId: `i${i}`,
      name,
      quantity: 1,
    }));
    expect(receiptNotice(receipt({ lines })).body).toContain('A ×1, B ×1, C ×1 và 2 món khác');
  });

  it('announces a void with its reason', () => {
    expect(voidedNotice(receipt(), 'Nhập nhầm')).toEqual({
      type: 'SHELF_RECEIPT_VOIDED',
      title: 'Phiếu đã bị hủy',
      body: 'Phiếu PG-20261107-AAAAAAAA đã bị hủy: Nhập nhầm. Số đồ trên kệ đã được cập nhật lại.',
      data,
    });
  });
});
