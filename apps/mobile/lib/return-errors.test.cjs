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

function loadReturnErrors() {
  const filename = path.join(__dirname, '../src/features/customer/return-errors.ts');
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
  return mod.exports;
}

test('returnErrorMessage shows conflicts verbatim and words 400 and 404 for the customer', () => {
  const { returnErrorMessage } = loadReturnErrors();
  const fields = (field) => ({ fields: [{ field, code: 'x', message: 'x' }] });
  const locked = 'Chi nhánh đã bắt đầu kiểm tra kho — không huỷ được yêu cầu trả kho';
  assert.equal(returnErrorMessage(new ApiError(locked, 409, 'RETURN_REQUEST_LOCKED'), 'f'), locked);
  assert.equal(
    returnErrorMessage(new ApiError('Validation failed', 400, 'V', fields('scheduledAt')), 'f'),
    'Chọn ngày trong 365 ngày tới',
  );
  assert.equal(
    returnErrorMessage(
      new ApiError('Validation failed', 400, 'V', fields('refundAccount.accountNo')),
      'f',
    ),
    'Kiểm tra lại tài khoản nhận hoàn',
  );
  assert.equal(
    returnErrorMessage(new ApiError('Not found', 404), 'f'),
    'Yêu cầu trả kho không còn — tải lại trang',
  );
  assert.equal(returnErrorMessage(new ApiError('Server', 500), 'fallback'), 'fallback');
  assert.equal(returnErrorMessage(new Error('boom'), 'fallback'), 'fallback');
});
