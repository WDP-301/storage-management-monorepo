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

const { availableHours, lastRequestDay, requestedForIso, toPickupRequestInput, vietnamToday } =
  load(path.join(__dirname, 'pickup-request-draft.ts'));

const items = [
  { id: 'a', name: 'Sách', quantity: 5 },
  { id: 'b', name: 'Chăn', quantity: 1 },
];

test('requested time carries the Vietnam offset', () => {
  assert.equal(requestedForIso('2026-11-08', 9), '2026-11-08T09:00:00+07:00');
});

test('last day is 30 days after today', () => {
  assert.equal(lastRequestDay('2026-11-07'), '2026-12-07');
});

test('vietnam day rolls over at 17:00 UTC', () => {
  assert.equal(vietnamToday(Date.parse('2026-11-07T17:30:00Z')), '2026-11-08');
});

test('today offers only hours that have not started', () => {
  const now = Date.parse('2026-11-07T03:30:00Z'); // 10:30 in Vietnam
  assert.deepEqual(availableHours('2026-11-07', now).slice(0, 2), [11, 12]);
  assert.equal(availableHours('2026-11-07', now).at(-1), 20);
  assert.equal(availableHours('2026-11-08', now).length, 13);
  assert.deepEqual(availableHours('2026-11-07', Date.parse('2026-11-07T14:00:00Z')), []);
});

test('valid draft becomes a request body', () => {
  const result = toPickupRequestInput(items, { a: 2, b: 0 }, '2026-11-08', 9, '  mang xe đẩy ');
  assert.deepEqual(result, {
    input: {
      lines: [{ itemId: 'a', quantity: 2 }],
      requestedFor: '2026-11-08T09:00:00+07:00',
      note: 'mang xe đẩy',
    },
  });
});

test('blank note is omitted', () => {
  const result = toPickupRequestInput(items, { b: 1 }, '2026-11-08', 9, '   ');
  assert.equal('note' in result.input, false);
});

test('rejects empty selection, missing day or hour, over-stock and long note', () => {
  assert.match(toPickupRequestInput(items, {}, '2026-11-08', 9, '').error, /ít nhất một món/);
  assert.match(toPickupRequestInput(items, { a: 1 }, null, 9, '').error, /ngày/);
  assert.match(toPickupRequestInput(items, { a: 1 }, '2026-11-08', null, '').error, /giờ/);
  assert.match(toPickupRequestInput(items, { b: 2 }, '2026-11-08', 9, '').error, /Chăn/);
  assert.match(
    toPickupRequestInput(items, { a: 1 }, '2026-11-08', 9, 'x'.repeat(501)).error,
    /500/,
  );
});
