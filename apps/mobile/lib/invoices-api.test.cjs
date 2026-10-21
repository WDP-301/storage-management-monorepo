const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// invoices-api imports only types besides './api', which gets stubbed.
function loadInvoicesApi(requestImpl) {
  const filename = path.join(__dirname, 'invoices-api.ts');
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

const row = {
  id: 'i1',
  invoiceNo: 'INV-001',
  contractId: 'c1',
  kind: 'INITIAL',
  periodNo: 2,
  startAt: '2026-11-30T17:00:00.000Z',
  endAt: '2026-12-31T17:00:00.000Z',
  dueAt: '2026-12-05T17:00:00.000Z',
  status: 'PARTIALLY_PAID',
  total: '1000000.00',
  paidAmount: 400000,
  amountDue: 600000,
  paymentQrUrl: 'https://img.vietqr.io/x.png',
  contract: { id: 'c1' },
};

test('listForContract asks for one contract and normalises amounts', async () => {
  const paths = [];
  const { InvoicesApi } = loadInvoicesApi(async (p) => {
    paths.push(p);
    return { items: [row], total: 1, page: 1, limit: 50 };
  });
  const [invoice] = await InvoicesApi.listForContract('c1');
  assert.equal(paths[0], '/invoices/my?contractId=c1&limit=50');
  assert.deepEqual(invoice, {
    id: 'i1',
    invoiceNo: 'INV-001',
    kind: 'INITIAL',
    periodNo: 2,
    startAt: '2026-11-30T17:00:00.000Z',
    dueAt: '2026-12-05T17:00:00.000Z',
    status: 'PARTIALLY_PAID',
    total: 1000000,
    paidAmount: 400000,
    amountDue: 600000,
    paymentQrUrl: 'https://img.vietqr.io/x.png',
  });
});

test('listForContract drops invoices of other contracts and tolerates a missing page', async () => {
  const other = { ...row, id: 'i2', contractId: 'c2' };
  const { InvoicesApi } = loadInvoicesApi(async () => ({ items: [row, other] }));
  assert.deepEqual(
    (await InvoicesApi.listForContract('c1')).map((invoice) => invoice.id),
    ['i1'],
  );
  const empty = loadInvoicesApi(async () => null).InvoicesApi;
  assert.deepEqual(await empty.listForContract('c1'), []);
});

test('normaliseInvoice keeps no QR when the API sends none', () => {
  const { normaliseInvoice } = loadInvoicesApi(async () => null);
  const invoice = normaliseInvoice({ ...row, paymentQrUrl: null, startAt: undefined });
  assert.equal(invoice.paymentQrUrl, null);
  assert.equal(invoice.startAt, null);
});
