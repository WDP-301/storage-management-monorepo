const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Compiles a .ts module and its relative imports for real; anything else is unexpected.
function load(file) {
  const filename = path.resolve(__dirname, file);
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name.startsWith('.')) return load(`${path.resolve(path.dirname(filename), name)}.ts`);
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

const draft = load('../src/features/customer/refund-account-draft.ts');
const empty = draft.EMPTY_REFUND_ACCOUNT;
const bank = { bankBin: '970436', bankName: 'Vietcombank' };
const verified = { ...bank, accountNo: '01234567', accountName: 'NGUYEN VAN A' };
const ready = { ...empty, ...bank, accountNo: ' 0123 4567 ', verified };
const sent = { bankBin: '970436', accountNo: '01234567' };

test('refund account draft is pre-filled, validated and sent as bank + number', () => {
  const saved = { ...bank, accountNo: '0123 4567', accountName: 'NGUYEN VAN A' };

  assert.equal(draft.draftFromAccount(null), empty);
  // Saved before verification existed: no BIN, so nothing to pre-fill.
  assert.equal(draft.draftFromAccount({ ...saved, bankBin: null }), empty);
  const prefilled = draft.draftFromAccount(saved);
  assert.equal(draft.verifiedAccount(prefilled).accountName, 'NGUYEN VAN A');
  assert.equal(draft.refundAccountProblem(prefilled), null);

  assert.equal(draft.isDraftEmpty(empty), true);
  assert.equal(draft.refundAccountProblem(empty), 'Chọn ngân hàng nhận hoàn cọc');
  const filled = { ...empty, ...bank };
  assert.match(draft.refundAccountProblem({ ...filled, accountNo: '12' }), /Số tài khoản/);
  assert.equal(
    draft.refundAccountProblem({ ...filled, accountNo: '0123' }),
    'Kiểm tra tài khoản trước khi gửi',
  );
  assert.equal(draft.refundAccountProblem(ready), null);
  assert.deepEqual(draft.toRefundAccountInput(ready), sent);
});

test('a verification stops counting once the bank or number changes', () => {
  assert.equal(draft.verifiedAccount(ready), verified);
  assert.equal(draft.verifiedAccount({ ...ready, accountNo: '0123 4568' }), null);
  assert.equal(draft.verifiedAccount({ ...ready, bankBin: '970415' }), null);
  assert.equal(draft.verifiedAccount({ ...ready, verified: null }), null);
});

test('a new request needs an account unless the deposit held is known to be zero', () => {
  const create = { isEdit: false, required: true, touched: false };
  assert.deepEqual(draft.refundAccountPayload(ready, create), {
    problem: null,
    refundAccount: sent,
  });
  assert.equal(draft.refundAccountPayload(empty, create).problem, 'Chọn ngân hàng nhận hoàn cọc');
  const unverified = { ...ready, verified: null };
  assert.equal(
    draft.refundAccountPayload(unverified, create).problem,
    'Kiểm tra tài khoản trước khi gửi',
  );
  const noDeposit = { ...create, required: false };
  assert.deepEqual(draft.refundAccountPayload(empty, noDeposit), { problem: null });
  assert.deepEqual(draft.refundAccountPayload(ready, noDeposit).refundAccount, sent);
});

test('a reschedule keeps the stored account unless the customer filled the form in', () => {
  const edit = { isEdit: true, required: false, touched: false };
  // Untouched — even if something sits in the form — sends nothing, so the API keeps its copy.
  assert.deepEqual(draft.refundAccountPayload(ready, edit), { problem: null });
  assert.deepEqual(draft.refundAccountPayload(empty, { ...edit, touched: true }), {
    problem: null,
  });
  assert.deepEqual(draft.refundAccountPayload(ready, { ...edit, touched: true }), {
    problem: null,
    refundAccount: sent,
  });
  const partial = { ...empty, ...bank };
  assert.match(
    draft.refundAccountPayload(partial, { ...edit, touched: true }).problem,
    /Số tài khoản/,
  );
});
