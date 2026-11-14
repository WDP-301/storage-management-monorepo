const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync(path.join(__dirname, 'unit-change-errors.ts'), 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', out)(mod, mod.exports);
  return mod.exports;
}

const { unitChangeErrorMessage } = load();
const FALLBACK = 'Gửi yêu cầu thất bại. Vui lòng thử lại.';

const validation = (code, message) =>
  Object.assign(new Error('Validation failed'), {
    code: 'VALIDATION_FAILED',
    details: { fields: [{ field: 'scheduledMoveAt', code, message }] },
  });

test('move-day rejections show the server field message instead of "Validation failed"', () => {
  const error = validation(
    'outOfRange',
    'Chọn ngày chuyển trong khoảng từ 16/11/2026 đến 90 ngày tới',
  );
  assert.equal(unitChangeErrorMessage(error, FALLBACK), error.details.fields[0].message);
});

test('an out-of-shift or past move time shows its field message', () => {
  const shift = validation(
    'moveTimeNotInShift',
    'Giờ chuyển kho phải nằm trong khung giờ hành chính',
  );
  assert.equal(unitChangeErrorMessage(shift, FALLBACK), shift.details.fields[0].message);
  const past = validation('pastTime', 'Giờ chuyển kho phải ở tương lai');
  assert.equal(unitChangeErrorMessage(past, FALLBACK), past.details.fields[0].message);
});

test('other errors keep their message, unknown values use the fallback', () => {
  assert.equal(unitChangeErrorMessage(new Error('Hết phiên'), FALLBACK), 'Hết phiên');
  assert.equal(unitChangeErrorMessage('boom', FALLBACK), FALLBACK);
  assert.equal(unitChangeErrorMessage(new Error(''), FALLBACK), FALLBACK);
});
