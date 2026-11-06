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

const d = load(path.join(__dirname, 'shelf-receipt-draft.ts'));
const photo = { fileKey: 'k', name: 'a.jpg', mimeType: 'image/jpeg' };
const ctx = {
  clientRequestId: 'c1',
  sessionId: 's1',
  contractId: 'k1',
  photos: [photo],
  note: ' ',
};
const items = [
  { id: 'i1', name: 'Sách', quantity: 5 },
  { id: 'i2', name: 'Chăn', quantity: 2 },
];

test('nameKey ignores case and extra spaces like the API', () => {
  assert.equal(d.nameKey('  Hộp   SÁCH '), d.nameKey('hộp sách'));
});

test('top-up raises an existing line, new item merges with a same-named line', () => {
  let draft = d.newDraft('DROP_OFF');
  draft = d.addTopUp(draft, items[0]);
  draft = d.addTopUp(draft, items[0]);
  draft = d.addNewItem(draft, ' sách ');
  assert.equal(draft.lines.length, 1);
  assert.equal(draft.lines[0].quantity, 3);
  draft = d.addNewItem(draft, 'Đèn   bàn');
  assert.equal(draft.lines[1].name, 'Đèn bàn');
  assert.equal(d.addNewItem(draft, '   ').lines.length, 2);
});

test('drop-off input needs a line and a photo, and sends itemId or name', () => {
  let draft = d.addNewItem(d.addTopUp(d.newDraft('DROP_OFF'), items[0]), 'Đèn');
  assert.deepEqual(d.toReceiptInput(d.newDraft('DROP_OFF'), ctx), {
    error: 'Thêm ít nhất một món với số lượng từ 1.',
  });
  assert.match(d.toReceiptInput(draft, { ...ctx, photos: [] }).error, /ảnh/);
  const { input } = d.toReceiptInput(draft, ctx);
  assert.deepEqual(input.lines, [
    { itemId: 'i1', quantity: 1 },
    { name: 'Đèn', quantity: 1 },
  ]);
  assert.equal(input.note, undefined);
  assert.equal(input.pickupRequestId, undefined);
  draft = d.setQuantity(draft, 'i1', 99999);
  assert.equal(draft.lines[0].quantity, 10000);
});

test('pick-up prefill is capped by stock and zero lines are dropped', () => {
  const draft = d.prefillPickUp(items, [{ itemId: 'i1', quantity: 9 }]);
  assert.deepEqual(
    draft.lines.map((l) => l.quantity),
    [5, 0],
  );
  const { input } = d.toReceiptInput(draft, { ...ctx, photos: [], pickupRequestId: 'r1' });
  assert.deepEqual(input.lines, [{ itemId: 'i1', quantity: 5 }]);
  assert.equal(input.photos, undefined);
  assert.equal(input.pickupRequestId, 'r1');
  const over = { ...draft, lines: draft.lines.map((l) => ({ ...l, quantity: 6 })) };
  assert.match(d.toReceiptInput(over, ctx).error, /chỉ còn 5/);
  assert.equal(d.setQuantity(draft, 'i2', 7).lines[1].quantity, 2);
});

test('duplicate names are refused', () => {
  const draft = {
    type: 'DROP_OFF',
    lines: [
      { key: 'a', name: 'Sách', quantity: 1 },
      { key: 'b', itemId: 'x', name: 'sách', quantity: 1 },
    ],
  };
  assert.match(d.toReceiptInput(draft, ctx).error, /trùng/);
});

test('recovery needs photo and note and removes blank lines', () => {
  const draft = d.prefillPickUp(items, [{ itemId: 'i2', quantity: 2 }]);
  assert.match(d.toRecoveryInput(draft, { ...ctx, photos: [], note: 'x' }).error, /ảnh/);
  assert.match(d.toRecoveryInput(draft, { ...ctx, note: '  ' }).error, /ghi chú/);
  const { input } = d.toRecoveryInput(draft, { ...ctx, note: ' Khách bỏ kho ' });
  assert.deepEqual(input.lines, [{ itemId: 'i2', quantity: 2 }]);
  assert.equal(input.note, 'Khách bỏ kho');
});
