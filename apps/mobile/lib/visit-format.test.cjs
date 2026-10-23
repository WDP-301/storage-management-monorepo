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

const { formatStay, visitStatusLabel, visitsSignature } = load(
  path.join(__dirname, 'visit-format.ts'),
);

const at = '2026-10-23T03:00:00.000Z';
const plus = (minutes) => Date.parse(at) + minutes * 60_000;

test('stay length reads in minutes, then hours and minutes', () => {
  assert.equal(formatStay(at, plus(0)), '0 phút');
  assert.equal(formatStay(at, plus(45)), '45 phút');
  assert.equal(formatStay(at, plus(120)), '2 giờ');
  assert.equal(formatStay(at, plus(125)), '2 giờ 5 phút');
  // A device clock behind the server never shows a negative stay.
  assert.equal(formatStay(at, plus(-5)), '0 phút');
});

test('visit status says inside, or how the visit ended', () => {
  assert.equal(visitStatusLabel({ checkedOutAt: null, checkOutMethod: null }), 'Đang trong kho');
  assert.equal(visitStatusLabel({ checkedOutAt: at, checkOutMethod: 'SCAN' }), 'Đã ra');
  assert.equal(
    visitStatusLabel({ checkedOutAt: at, checkOutMethod: 'MANUAL' }),
    'Nhân viên cho ra',
  );
  assert.equal(visitStatusLabel({ checkedOutAt: at, checkOutMethod: 'AUTO' }), 'Không check-out');
});

test('the signature changes on entry and on exit', () => {
  const inside = { id: 'v-1', checkedOutAt: null };
  const left = { id: 'v-1', checkedOutAt: at };
  const none = visitsSignature({ current: null, recent: [] });
  const entered = visitsSignature({ current: inside, recent: [inside] });
  const exited = visitsSignature({ current: null, recent: [left] });
  assert.notEqual(none, entered);
  assert.notEqual(entered, exited);
  assert.equal(exited, visitsSignature({ current: null, recent: [left] }));
});
