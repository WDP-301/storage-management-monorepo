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

const { addNewLine, toDropOffRequestInput } = load(
  path.join(__dirname, 'drop-off-request-draft.ts'),
);
const { prefillDropOff, toReceiptInput } = load(path.join(__dirname, 'shelf-receipt-draft.ts'));

const items = [
  { id: 'a', name: 'Sách' },
  { id: 'b', name: 'Chăn' },
];

test('existing items go by id, new items by name, with the Vietnam offset and a trimmed note', () => {
  const result = toDropOffRequestInput(
    items,
    { a: 2, b: 0 },
    [{ key: 'xe đạp', name: 'Xe đạp', quantity: 1 }],
    '2026-11-20',
    9,
    '  sáng mai  ',
  );
  assert.deepEqual(result, {
    input: {
      lines: [
        { itemId: 'a', quantity: 2 },
        { name: 'Xe đạp', quantity: 1 },
      ],
      requestedFor: '2026-11-20T09:00:00+07:00',
      note: 'sáng mai',
    },
  });
});

test('nothing chosen, no day or no hour are refused in Vietnamese', () => {
  assert.deepEqual(toDropOffRequestInput(items, {}, [], '2026-11-20', 9, ''), {
    error: 'Chọn hoặc thêm ít nhất một món sẽ gửi.',
  });
  assert.deepEqual(toDropOffRequestInput(items, { a: 1 }, [], null, 9, ''), {
    error: 'Chọn ngày gửi đồ.',
  });
  assert.deepEqual(toDropOffRequestInput(items, { a: 1 }, [], '2026-11-20', null, ''), {
    error: 'Chọn giờ gửi đồ.',
  });
});

test('a typed name that is already on the shelf must be picked from the list', () => {
  const result = toDropOffRequestInput(
    items,
    {},
    [{ key: 'sách', name: 'sách', quantity: 1 }],
    '2026-11-20',
    9,
    '',
  );
  assert.match(result.error, /đã có trên kệ/);
});

test('adding the same name twice raises the quantity instead of a second line', () => {
  const once = addNewLine([], '  Xe   đạp ');
  assert.deepEqual(once, [{ key: 'xe đạp', name: 'Xe đạp', quantity: 1 }]);
  assert.deepEqual(addNewLine(once, 'XE ĐẠP'), [{ key: 'xe đạp', name: 'Xe đạp', quantity: 2 }]);
  assert.deepEqual(addNewLine(once, '   '), once);
});

test('a drop-off receipt prefilled from a request carries its lines and the request id', () => {
  const draft = prefillDropOff([
    { itemId: 'a', name: 'Sách', quantity: 2 },
    { itemId: null, name: 'Xe đạp', quantity: 1 },
  ]);
  assert.equal(draft.type, 'DROP_OFF');
  const built = toReceiptInput(draft, {
    clientRequestId: 'c',
    sessionId: 's',
    contractId: 'k',
    photos: [{ fileKey: 'uploads/u-1', name: 'a.jpg', mimeType: 'image/jpeg' }],
    note: '',
    dropOffRequestId: 'req-1',
    pickupRequestId: 'ignored-for-drop-off',
  });
  assert.deepEqual(built.input.lines, [
    { itemId: 'a', quantity: 2 },
    { name: 'Xe đạp', quantity: 1 },
  ]);
  assert.equal(built.input.dropOffRequestId, 'req-1');
  assert.equal('pickupRequestId' in built.input, false);
});
