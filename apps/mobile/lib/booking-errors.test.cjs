const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync(path.join(__dirname, 'booking-errors.ts'), 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', out)(mod, mod.exports);
  return mod.exports;
}

const { bookingErrorMessage } = load();

test('unit conflicts map to a Vietnamese message instead of server text', () => {
  const error = Object.assign(new Error('Một hoặc nhiều storage unit không còn available'), {
    code: 'UNIT_NOT_AVAILABLE',
  });
  assert.match(bookingErrorMessage(error), /chọn kho khác/);
});

test('a vanished unit gets the same guidance', () => {
  const error = Object.assign(new Error('not found'), { code: 'RESOURCE_NOT_FOUND' });
  assert.match(bookingErrorMessage(error), /chọn kho khác/);
});

test('other errors keep their message, unknown values use the fallback', () => {
  assert.equal(bookingErrorMessage(new Error('Hết phiên')), 'Hết phiên');
  assert.match(bookingErrorMessage('boom'), /Không giữ được kho/);
});
