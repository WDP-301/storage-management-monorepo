const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadAccountApi(requestImpl) {
  const filename = path.join(__dirname, 'account-api.ts');
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name === './api') return { request: requestImpl };
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

test('AccountApi.updateProfile patches /customers/:id/profile', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { AccountApi } = loadAccountApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { user: { id: 'u-1', fullName: 'Nguyễn Văn B', phone: '0912345678' }, profile: null };
  });

  const res = await AccountApi.updateProfile('u-1', {
    fullName: 'Nguyễn Văn B',
    phone: '0912345678',
  });
  assert.equal(capturedPath, '/customers/u-1/profile');
  assert.equal(capturedInit.method, 'PATCH');
  assert.deepEqual(JSON.parse(capturedInit.body), {
    fullName: 'Nguyễn Văn B',
    phone: '0912345678',
  });
  assert.equal(res.user.fullName, 'Nguyễn Văn B');
});

test('AccountApi.changePassword patches /customers/me/password', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { AccountApi } = loadAccountApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { message: 'Password changed successfully' };
  });

  const body = {
    currentPassword: 'OldPassword123',
    newPassword: 'NewPassword123',
    confirmPassword: 'NewPassword123',
  };
  const res = await AccountApi.changePassword(body);
  assert.equal(capturedPath, '/customers/me/password');
  assert.equal(capturedInit.method, 'PATCH');
  assert.deepEqual(JSON.parse(capturedInit.body), body);
  assert.equal(res.message, 'Password changed successfully');
});
