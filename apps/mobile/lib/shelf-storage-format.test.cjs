const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(filename) {
  const mod = new Module(filename);
  mod.require = (name) => {
    if (!name.startsWith('.')) throw new Error(`Unexpected import: ${name}`);
    return load(path.resolve(path.dirname(filename), `${name}.ts`));
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports;
}

const f = load(path.join(__dirname, 'shelf-storage-format.ts'));

test('labels cover every receipt type, request status and block reason', () => {
  assert.equal(f.receiptTypeLabel('DROP_OFF'), 'Phiếu gửi đồ');
  assert.equal(f.receiptTypeLabel('PICK_UP'), 'Phiếu lấy đồ');
  assert.deepEqual(['PENDING', 'READY', 'COMPLETED', 'CANCELLED'].map(f.pickupStatusLabel), [
    'Chờ chuẩn bị',
    'Đã sẵn sàng',
    'Đã lấy',
    'Đã hủy',
  ]);
  assert.equal(f.recoveredLabel, 'Thu hồi (khách bỏ kho)');
  for (const reason of ['CONTRACT_NOT_STARTED', 'INVOICE_OVERDUE']) {
    assert.notEqual(f.dropOffBlockLabel(reason), 'Chưa thể nhận đồ');
  }
  for (const reason of ['NO_STOCK', 'INVOICE_OVERDUE']) {
    assert.notEqual(f.pickUpBlockLabel(reason), 'Chưa thể trả đồ');
  }
  for (const reason of [
    'CONTRACT_NOT_ACTIVE',
    'OPEN_REQUEST_EXISTS',
    'NO_STOCK',
    'INVOICE_OVERDUE',
  ]) {
    assert.notEqual(f.pickupRequestBlockLabel(reason), 'Chưa thể tạo yêu cầu lấy đồ');
  }
});

test('lines summary shows three lines and counts the rest', () => {
  const lines = [
    { name: 'Sách', quantity: 2 },
    { name: 'Chăn', quantity: 1 },
    { name: 'Đèn', quantity: 4 },
    { name: 'Ghế', quantity: 1 },
  ];
  assert.equal(f.linesSummary(lines), 'Sách ×2, Chăn ×1, Đèn ×4 và 1 món khác');
  assert.equal(f.linesSummary(lines.slice(0, 1)), 'Sách ×2');
  assert.equal(f.totalQuantity(lines), 8);
  assert.equal(f.totalQuantity([]), 0);
});

test('session countdown never goes negative and tolerates a bad date', () => {
  const now = Date.parse('2026-11-07T10:00:00Z');
  assert.equal(f.sessionSecondsLeft('2026-11-07T10:30:00Z', now), 1800);
  assert.equal(f.sessionSecondsLeft('2026-11-07T10:00:00.400Z', now), 1);
  assert.equal(f.sessionSecondsLeft('2026-11-07T09:00:00Z', now), 0);
  assert.equal(f.sessionSecondsLeft('not a date', now), 0);
});

test('every reason in the contract has its own message, not the fallback', () => {
  const cases = {
    ACCESS_PASS_INVALID: ['MALFORMED', 'NOT_FOUND', 'USED', 'EXPIRED'],
    CHECK_IN_NOT_ALLOWED: ['NO_SHELF_CONTRACT', 'CONTRACT_NOT_STARTED'],
    COUNTER_SESSION_INVALID: ['NOT_FOUND', 'EXPIRED', 'WRONG_CUSTOMER', 'WRONG_WAREHOUSE'],
    SHELF_RECEIPT_NOT_ALLOWED: [
      'CONTRACT_NOT_ACTIVE',
      'CONTRACT_NOT_STARTED',
      'PICKUP_REQUEST_MISMATCH',
      'ITEM_NOT_IN_CONTRACT',
      'CLIENT_REQUEST_REUSED',
      'NOT_ABANDONED_RETURN',
    ],
    SHELF_STOCK_INSUFFICIENT: ['PICK_UP', 'VOID'],
    PICKUP_REQUEST_NOT_ALLOWED: [
      'CONTRACT_NOT_ACTIVE',
      'OPEN_REQUEST_EXISTS',
      'NO_STOCK',
      'QUANTITY_EXCEEDS_STOCK',
      'ITEM_NOT_IN_CONTRACT',
      'NOT_PENDING',
      'NOT_OPEN',
    ],
    CONFLICT: ['ALREADY_VOIDED'],
  };
  for (const [code, reasons] of Object.entries(cases)) {
    for (const reason of reasons) {
      assert.notEqual(
        f.shelfErrorMessage(code, { reason }, 'FALLBACK'),
        'FALLBACK',
        `${code} ${reason}`,
      );
    }
  }
  assert.match(
    f.shelfErrorMessage('INVOICE_OVERDUE', { invoiceNos: ['INV-1', 'INV-2'] }, 'x'),
    /INV-1, INV-2/,
  );
});

test('error details are spelled out and the server text passes through where asked', () => {
  assert.match(
    f.shelfErrorMessage(
      'SHELF_STOCK_INSUFFICIENT',
      { reason: 'PICK_UP', items: [{ itemId: 'i', name: 'Chăn', requested: 3, available: 1 }] },
      'x',
    ),
    /Chăn \(cần 3, còn 1\)/,
  );
  assert.equal(
    f.shelfErrorMessage('SHELF_NOT_EMPTY', { reason: 'RETURN' }, 'Kệ còn 4 món đồ của khách'),
    'Kệ còn 4 món đồ của khách',
  );
  assert.match(
    f.shelfErrorMessage('ACCESS_PASS_INVALID', { reason: 'USED', verifiedByMe: true }, 'x'),
    /bạn đã quét/,
  );
  assert.equal(f.shelfErrorMessage('SOMETHING_NEW', { reason: 'X' }, 'Lỗi mạng'), 'Lỗi mạng');
  assert.equal(f.shelfErrorMessage(undefined, undefined, 'Lỗi mạng'), 'Lỗi mạng');
});

test('validation failures use the first field code this build knows', () => {
  const details = {
    fields: [
      { field: 'x', code: 'unknown' },
      { field: 'photos', code: 'required' },
    ],
  };
  assert.equal(f.shelfErrorMessage('VALIDATION_FAILED', details, 'x'), 'Cần ít nhất một ảnh.');
  assert.equal(f.shelfErrorMessage('VALIDATION_FAILED', { fields: [] }, 'chung'), 'chung');
});
