const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

class ApiError extends Error {
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const filename = path.resolve(__dirname, '../src/features/customer/bank-verify-errors.ts');
const mod = new Module(filename);
mod.require = (name) => {
  if (name === '../../../lib/api') return { ApiError };
  throw new Error(`Unexpected import: ${name}`);
};
mod._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  filename,
);
const { bankCheckErrorMessage, isBankCheckError } = mod.exports;

test('bank check failures read as a reason the customer can act on', () => {
  const invalid = (reason) => new ApiError('x', 400, 'BANK_ACCOUNT_INVALID', { reason });
  assert.match(bankCheckErrorMessage(invalid('ACCOUNT')), /không tồn tại/);
  assert.match(bankCheckErrorMessage(invalid('BANK')), /Ngân hàng không hợp lệ/);
  assert.match(bankCheckErrorMessage(new ApiError('x', 429, 'T')), /quá nhiều lần/);
  assert.match(bankCheckErrorMessage(new ApiError('x', 503, 'SERVICE_UNAVAILABLE')), /thử lại/);
  assert.match(bankCheckErrorMessage(new Error('boom')), /thử lại/);
  assert.equal(isBankCheckError(invalid('BANK')), true);
  assert.equal(isBankCheckError(new ApiError('x', 409, 'C')), false);
});
