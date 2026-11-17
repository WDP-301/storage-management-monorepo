const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

class FakeApiError extends Error {
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function loadForm() {
  const filename = path.join(__dirname, 'account-form.ts');
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name === './api') return { ApiError: FakeApiError };
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

const { validateProfileForm, buildUpdateProfilePayload, validatePasswordForm, mapAccountError } =
  loadForm();

test('validateProfileForm checks fullName, phone, and ward-requires-province', () => {
  assert.equal(
    validateProfileForm(
      {
        fullName: '   ',
        phone: '123',
        addressLine: '',
        province: '',
        ward: '00008',
        companyName: '',
        taxCode: '',
      },
      { includeCustomerFields: true },
    ).fullName,
    'Vui lòng nhập họ và tên.',
  );

  const errors = validateProfileForm(
    {
      fullName: 'Trần Văn A',
      phone: '0123456789',
      addressLine: '',
      province: '',
      ward: '00008',
      companyName: '',
      taxCode: '',
    },
    { includeCustomerFields: true },
  );
  assert.ok(errors.phone);
  assert.ok(errors.province);
});

test('buildUpdateProfilePayload strips customer-only fields for staff accounts', () => {
  const staffPayload = buildUpdateProfilePayload(
    {
      fullName: '  Nguyễn Nhân Viên  ',
      phone: '0912 345 678',
      addressLine: 'ignored',
      province: '01',
      ward: '00008',
      companyName: 'ignored',
      taxCode: 'ignored',
    },
    { includeCustomerFields: false },
  );
  assert.deepEqual(staffPayload, {
    fullName: 'Nguyễn Nhân Viên',
    phone: '0912345678',
  });

  const customerPayload = buildUpdateProfilePayload(
    {
      fullName: 'Nguyễn Khách',
      phone: '+84 912 345 678',
      addressLine: ' 123 Lê Lợi ',
      province: '79',
      ward: '',
      companyName: '',
      taxCode: '',
    },
    { includeCustomerFields: true },
  );
  assert.deepEqual(customerPayload, {
    fullName: 'Nguyễn Khách',
    phone: '+84912345678',
    addressLine: '123 Lê Lợi',
    province: '79',
    ward: '',
    companyName: '',
    taxCode: '',
  });
});

test('validatePasswordForm enforces length, mismatch, and distinct password rules', () => {
  const errShort = validatePasswordForm({
    currentPassword: 'OldPassword123',
    newPassword: 'short',
    confirmPassword: 'other',
  });
  assert.ok(errShort.newPassword);
  assert.ok(errShort.confirmPassword);

  const errSame = validatePasswordForm({
    currentPassword: 'SamePassword123',
    newPassword: 'SamePassword123',
    confirmPassword: 'SamePassword123',
  });
  assert.equal(errSame.newPassword, 'Mật khẩu mới phải khác mật khẩu hiện tại.');

  assert.deepEqual(
    validatePasswordForm({
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
      confirmPassword: 'NewPassword123',
    }),
    {},
  );
});

test('mapAccountError maps backend validation codes to Vietnamese field messages', () => {
  const err = new FakeApiError('Validation failed', 400, 'VALIDATION_FAILED', {
    fields: [
      {
        field: 'currentPassword',
        code: 'invalidCredentials',
        message: 'Current password is incorrect',
      },
    ],
  });
  const mapped = mapAccountError(err, 'Fallback');
  assert.equal(mapped.fieldErrors.currentPassword, 'Mật khẩu hiện tại không đúng.');
  assert.equal(mapped.message, 'Mật khẩu hiện tại không đúng.');
});
