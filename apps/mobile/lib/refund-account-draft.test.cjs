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
const ready = {
  ...empty,
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: ' 0123 4567 ',
  accountName: 'Nguyễn Văn Ạ',
};
const sent = {
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '01234567',
  accountName: 'NGUYEN VAN A',
};

test('refund account draft is pre-filled, validated and sent with the holder name folded', () => {
  const listed = (bin) => bin === '970436';
  const saved = {
    bankBin: '970436',
    bankName: 'Vietcombank',
    accountNo: '0123',
    accountName: 'A B',
  };

  assert.equal(draft.draftFromAccount(null, listed), draft.EMPTY_REFUND_ACCOUNT);
  assert.equal(draft.draftFromAccount(saved, listed).bankBin, '970436');
  const stale = draft.draftFromAccount({ ...saved, bankBin: '999999' }, listed);
  assert.deepEqual([stale.bankBin, stale.isOtherBank, stale.bankName], [null, true, 'Vietcombank']);

  assert.equal(draft.isDraftEmpty(empty), true);
  assert.equal(draft.refundAccountProblem(empty), 'Chọn ngân hàng nhận hoàn cọc');
  assert.equal(draft.refundAccountProblem({ ...empty, isOtherBank: true }), 'Nhập tên ngân hàng');
  const filled = { ...empty, bankBin: '970436', bankName: 'Vietcombank' };
  assert.match(draft.refundAccountProblem({ ...filled, accountNo: '12' }), /Số tài khoản/);
  assert.equal(
    draft.refundAccountProblem({ ...filled, accountNo: '0123', accountName: ' ' }),
    'Nhập tên chủ tài khoản',
  );
  assert.equal(draft.refundAccountProblem(ready), null);
  assert.deepEqual(draft.toRefundAccountInput(ready), sent);
});

test('a new request needs an account unless the deposit held is known to be zero', () => {
  const create = { isEdit: false, required: true, touched: false };
  assert.deepEqual(draft.refundAccountPayload(ready, create), {
    problem: null,
    refundAccount: sent,
  });
  assert.equal(draft.refundAccountPayload(empty, create).problem, 'Chọn ngân hàng nhận hoàn cọc');
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
  const partial = { ...empty, isOtherBank: true };
  assert.equal(
    draft.refundAccountPayload(partial, { ...edit, touched: true }).problem,
    'Nhập tên ngân hàng',
  );
});
