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

const format = load('settlement-format.ts');
const { formatMoney } = load('format-vi.ts');
const customerDir = '../src/features/customer';

test('toAccountHolderName folds diacritics and đ the way banks print names', () => {
  assert.equal(format.toAccountHolderName('Nguyễn Văn Ạ'), 'NGUYEN VAN A');
  assert.equal(format.toAccountHolderName('  đặng   thị  Hồng '), 'DANG THI HONG');
});

test('vietnamDayIso reads instants on the Vietnam calendar, not UTC', () => {
  assert.equal(format.vietnamDayIso('2026-10-20T16:59:59.000Z'), '2026-10-20');
  assert.equal(format.vietnamDayIso('2026-10-20T17:00:00.000Z'), '2026-10-21');
  assert.equal(format.vietnamDayIso('not a date'), null);
});

test('lastDayIso is the day before the exclusive term end', () => {
  // 00:00 Vietnam on 01/04/2027 → the term runs to the end of 31/03/2027.
  assert.equal(format.lastDayIso('2027-03-31T17:00:00.000Z'), '2027-03-31');
  assert.equal(format.addDaysIso('2027-02-28', 1), '2027-03-01');
  assert.equal(format.daysBetweenIso('2027-03-31', '2027-04-03'), 3);
});

test('willBeVoidedOnReturn compares Vietnam days of period start and return day', () => {
  const returnAt = '2026-12-01T12:00:00.000Z';
  // Starts 00:00 Vietnam on 01/12 — the return day itself — so it is voided.
  assert.equal(format.willBeVoidedOnReturn('2026-11-30T17:00:00.000Z', returnAt), true);
  assert.equal(format.willBeVoidedOnReturn('2026-11-30T16:59:00.000Z', returnAt), false);
  assert.equal(format.willBeVoidedOnReturn(null, returnAt), false);
  assert.equal(format.willBeVoidedOnReturn('2026-12-05T00:00:00.000Z', null), false);
});

test('isInvoiceDue only counts issued invoices with money still owed', () => {
  assert.equal(format.isInvoiceDue({ status: 'ISSUED', amountDue: 1 }), true);
  assert.equal(format.isInvoiceDue({ status: 'PARTIALLY_PAID', amountDue: 5 }), true);
  assert.equal(format.isInvoiceDue({ status: 'PARTIALLY_PAID', amountDue: 0 }), false);
  assert.equal(format.isInvoiceDue({ status: 'PAID', amountDue: 0 }), false);
  assert.equal(format.isInvoiceDue({ status: 'VOID', amountDue: 100 }), false);
  assert.equal(format.invoiceTitle({ kind: 'SETTLEMENT', periodNo: 1 }), 'Phí quyết toán cọc');
  assert.equal(format.invoiceTitle({ kind: 'INITIAL', periodNo: 3 }), 'Tiền thuê kỳ 3');
});

const totals = (refund, shortfall = 0) => ({
  deposit_amount: 2000000,
  credits_total: 0,
  deductions_total: 2000000 - refund,
  refund_amount: refund,
  shortfall_amount: shortfall,
});
const account = { bank_name: 'Vietcombank', account_no_masked: '••••6789', account_name: 'A' };

test('settlementHeadline states each settlement stage from the server figures', () => {
  const base = { lines: [], deposit_amount: 2000000, fee_invoice_id: null, approved_at: null };
  assert.equal(
    format.settlementHeadline({ ...base, status: 'PENDING', totals: null, refund_account: null }),
    'Đang quyết toán cọc',
  );
  assert.equal(
    format.settlementHeadline({
      ...base,
      status: 'AWAITING_REFUND',
      totals: totals(1500000),
      refund_account: account,
    }),
    `Đang chuyển ${formatMoney(1500000)} về Vietcombank ••••6789`,
  );
  assert.equal(
    format.settlementHeadline({
      ...base,
      status: 'COMPLETED',
      totals: totals(1500000),
      refund_account: account,
      completed_at: '2026-10-20T17:30:00.000Z',
    }),
    `Đã hoàn ${formatMoney(1500000)} ngày 21/10/2026`,
  );
  assert.equal(
    format.settlementHeadline({ ...base, status: 'COMPLETED', totals: totals(0, 500000) }),
    'Đã quyết toán cọc',
  );
});

test('settlement lines read as credit, deduction or waived; badges and hints follow status', () => {
  assert.equal(
    format.settlementLineAmount({ direction: 'CREDIT', amount: 1000, waived: false }),
    `+ ${formatMoney(1000)}`,
  );
  assert.equal(
    format.settlementLineAmount({ direction: 'DEDUCTION', amount: 1000, waived: false }),
    `− ${formatMoney(1000)}`,
  );
  assert.equal(
    format.settlementLineAmount({ direction: 'DEDUCTION', amount: 0, waived: true }),
    'Miễn',
  );
  assert.deepEqual(format.settlementBadge('COMPLETED'), { label: 'Hoàn tất', tone: 'success' });
  assert.equal(format.endedContractHint(null), null);
  assert.equal(format.endedContractHint({ status: 'PENDING' }), 'Đang quyết toán cọc');
  assert.equal(format.endedContractHint({ status: 'AWAITING_REFUND' }), 'Đang hoàn tiền cọc');
  assert.equal(format.endedContractHint({ status: 'COMPLETED' }), 'Đã quyết toán cọc');
});

test('returnSourceNote names only requests the branch made', () => {
  assert.match(format.returnSourceNote('HOTLINE'), /chi nhánh tạo.*hotline/);
  assert.match(format.returnSourceNote('ABANDONED'), /chi nhánh tạo.*bỏ kho/);
  assert.equal(format.returnSourceNote('CUSTOMER'), null);
  assert.equal(format.returnSourceNote(undefined), null);
});

test('termEndState warns from the notice window, then overdue until a return is booked', () => {
  const { termEndState } = load(`${customerDir}/term-end.ts`);
  // Last day 31/03/2027; term end (exclusive) 01/04/2027.
  const active = { status: 'ACTIVE', termEndAt: '2027-03-31T17:00:00.000Z', return: null };
  const open = (scheduledAt) => ({ ...active, return: { scheduledAt, finalizedAt: null } });

  assert.equal(termEndState(active, '2027-02-28', 30), null);
  assert.deepEqual(termEndState(active, '2027-03-01', 30), {
    kind: 'ending',
    lastDay: '2027-03-31',
    penaltyFromDay: '2027-04-02',
  });
  assert.equal(termEndState(open('2027-03-31T12:00:00.000Z'), '2027-03-15', 30), null);
  assert.deepEqual(termEndState(active, '2027-04-03', 30), {
    kind: 'overdue',
    lastDay: '2027-03-31',
    daysOverdue: 3,
  });
  assert.equal(termEndState(open('2027-04-03T12:00:00.000Z'), '2027-04-03', 30), null);
  assert.equal(termEndState(open('2027-04-02T12:00:00.000Z'), '2027-04-03', 30).kind, 'overdue');
  assert.equal(termEndState({ ...active, status: 'ENDED' }, '2027-04-03', 30), null);
  assert.equal(termEndState({ ...active, termEndAt: null }, '2027-04-03', 30), null);
});
