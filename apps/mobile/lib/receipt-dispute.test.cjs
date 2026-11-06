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

const d = load(path.join(__dirname, 'receipt-dispute.ts'));

test('only an active receipt without an open dispute can be reported', () => {
  assert.equal(d.canReportReceipt({ status: 'ACTIVE', openDisputeTicket: null }), true);
  assert.equal(d.canReportReceipt({ status: 'VOIDED', openDisputeTicket: null }), false);
  assert.equal(d.canReportReceipt({ status: 'ACTIVE', openDisputeTicket: { id: 't' } }), false);
});

test('subject and description name the receipt', () => {
  assert.equal(d.disputeSubject('PG-1'), 'Báo sai phiếu PG-1');
  const at = new Date(2026, 10, 7, 9, 5);
  const text = d.disputeDescription({
    code: 'PL-2',
    type: 'PICK_UP',
    shelf: { code: 'K-01' },
    createdAt: at.toISOString(),
  });
  assert.equal(text, 'Phiếu PL-2 (Lấy đồ · kệ K-01 · 07/11/2026 09:05) bị ghi sai:\n');
  assert.match(
    d.disputeDescription({ code: 'PG-1', type: 'DROP_OFF', shelf: { code: 'K' }, createdAt: 'x' }),
    /^Phiếu PG-1 \(Gửi đồ · kệ K\) bị ghi sai:\n$/,
  );
});

test('dispute options hold only the receipt facility with every type and no units', () => {
  const types = [
    { id: 'a', code: 'SUPPORT', name: 'Hỗ trợ' },
    { id: 'b', code: 'MAINTENANCE', name: 'Bảo trì' },
  ];
  const out = d.disputeFormOptions(
    { types, facilities: [{ id: 'other', code: 'O', name: 'O', units: [], typeIds: [] }] },
    { facility: { id: 'f1', code: 'F1', name: 'Kho 1' } },
  );
  assert.deepEqual(out.facilities, [
    { id: 'f1', code: 'F1', name: 'Kho 1', units: [], typeIds: ['a', 'b'] },
  ]);
  assert.equal(d.supportTypeId(types), 'a');
  assert.equal(d.supportTypeId([types[1]]), null);
});

test('refusals map to Vietnamese messages', () => {
  assert.equal(
    d.disputeErrorMessage({ statusCode: 404, message: 'x' }),
    'Không tìm thấy phiếu này.',
  );
  assert.equal(
    d.disputeErrorMessage({ statusCode: 409, details: { reason: 'RECEIPT_VOIDED' } }),
    'Phiếu đã bị hủy, không cần báo sai.',
  );
  assert.equal(
    d.disputeErrorMessage({
      statusCode: 409,
      details: { reason: 'OPEN_DISPUTE_EXISTS', ticketNo: 'ST-9' },
    }),
    'Phiếu này đã được báo sai (ST-9), đang chờ xử lý.',
  );
  assert.equal(d.disputeErrorMessage({ statusCode: 500, message: 'Lỗi' }), 'Lỗi');
  assert.equal(d.disputeErrorMessage(null), 'Không gửi được yêu cầu. Thử lại.');
});

test('only refusals about the receipt itself end the dispute', () => {
  assert.equal(d.isDisputeEnding({ statusCode: 404 }), true);
  assert.equal(d.isDisputeEnding({ statusCode: 409, details: { reason: 'RECEIPT_VOIDED' } }), true);
  assert.equal(
    d.isDisputeEnding({ statusCode: 409, details: { reason: 'OPEN_DISPUTE_EXISTS' } }),
    true,
  );
  assert.equal(d.isDisputeEnding({ statusCode: 400, details: { fields: [] } }), false);
  assert.equal(d.isDisputeEnding({ statusCode: 500 }), false);
  assert.equal(d.isDisputeEnding(null), false);
});

test('a loaded receipt that cannot be reported explains why', () => {
  assert.equal(d.receiptBlockedMessage({ status: 'ACTIVE', openDisputeTicket: null }), null);
  assert.equal(
    d.receiptBlockedMessage({ status: 'VOIDED', openDisputeTicket: null }),
    'Phiếu đã bị hủy, không cần báo sai.',
  );
  assert.equal(
    d.receiptBlockedMessage({ status: 'ACTIVE', openDisputeTicket: { ticketNo: 'ST-3' } }),
    'Phiếu này đã được báo sai (ST-3), đang chờ xử lý.',
  );
});
