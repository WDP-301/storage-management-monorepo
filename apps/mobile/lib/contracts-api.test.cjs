const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Loads a lib/*.ts module with './api' stubbed and sibling './evidence' compiled for real.
function load(file, requestImpl) {
  const filename = path.join(__dirname, file);
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name === './api') return { request: requestImpl };
    if (name === './evidence') return load('evidence.ts', requestImpl);
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

const baseContract = {
  id: 'c1',
  contract_no: 'HD-001',
  kind: 'RENTAL',
  status: 'ACTIVE',
  effective_at: '2026-10-01T00:00:00.000Z',
  ended_at: null,
  signed_at: null,
  months: 6,
  monthly_price: '1000000',
  deposit: '2000000',
  unit: null,
  facility: null,
  handover: null,
  return: null,
};

test('normaliseContract keeps well-formed documents and drops legacy entries', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  const file = { fileKey: 'uploads/a.pdf', name: 'a.pdf', mimeType: 'application/pdf' };
  const contract = normaliseContract({
    ...baseContract,
    documents: [file, 'https://old.example/x.jpg', null],
  });
  assert.deepEqual(contract.documents, [file]);
});

test('normaliseContract defaults documents to empty when the API omits them', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  assert.deepEqual(normaliseContract(baseContract).documents, []);
  assert.deepEqual(normaliseContract({ ...baseContract, documents: null }).documents, []);
});

test('normaliseContract reports amenities as null when the API omits or nulls them', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  assert.equal(normaliseContract(baseContract).amenities, null);
  assert.equal(normaliseContract({ ...baseContract, amenities: null }).amenities, null);
});

test('normaliseContract keeps an empty amenity snapshot distinct from null', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  assert.deepEqual(normaliseContract({ ...baseContract, amenities: [] }).amenities, []);
});

test('normaliseContract keeps valid amenities in order and drops malformed entries', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  const wifi = { amenityId: 'a1', code: 'WIFI', name: 'Wifi', quantity: 1, note: null };
  const camera = { amenityId: 'a2', code: 'CCTV', name: 'Camera', quantity: 4, note: 'Cổng chính' };
  const contract = normaliseContract({
    ...baseContract,
    amenities: [
      wifi,
      null,
      'Wifi',
      { amenityId: 'a3', name: 'No quantity' },
      { amenityId: 'a4', name: 'Bad quantity', quantity: Number.NaN },
      { name: 'No id', quantity: 1 },
      camera,
    ],
  });
  assert.deepEqual(contract.amenities, [wifi, camera]);
});

test('ContractDocumentsApi.replace PUTs the full list and returns the saved files', async () => {
  const calls = [];
  const file = { fileKey: 'uploads/a.pdf', name: 'a.pdf', mimeType: 'application/pdf' };
  const { ContractDocumentsApi } = load('contract-documents-api.ts', async (path, init) => {
    calls.push({ path, init });
    return { id: 'c1', status: 'ACTIVE', documents: [file] };
  });
  const saved = await ContractDocumentsApi.replace('c1', [file]);
  assert.equal(calls[0].path, '/contracts/c1/documents');
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].init.body), { documents: [file] });
  assert.deepEqual(saved, [file]);
});

test('normaliseContract reads term, deposit, penalty and settlement as unknown on older APIs', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  const contract = normaliseContract(baseContract);
  assert.equal(contract.deposit, 2000000);
  assert.equal(contract.termEndAt, null);
  assert.equal(contract.overduePenaltyPerDay, null);
  assert.equal(contract.settlement, null);
});

test('normaliseContract keeps an undetermined deposit as null, never 0', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  assert.equal(normaliseContract({ ...baseContract, deposit: null }).deposit, null);
});

test('normaliseContract maps the term end, per-day penalty, settlement and request source', () => {
  const { normaliseContract } = load('contracts-api.ts', async () => null);
  const settlement = { status: 'PENDING', deposit_amount: 2000000, lines: null, totals: null };
  const contract = normaliseContract({
    ...baseContract,
    deposit: 2000000,
    term_end_at: '2027-03-31T17:00:00.000Z',
    overdue_penalty_per_day: '33333',
    settlement,
    return: {
      id: 'r1',
      type: 'RETURN',
      scheduled_at: '2027-04-01T12:00:00.000Z',
      inspected_at: null,
      finalized_at: null,
      inspector_name: null,
      request_note: null,
      request_source: 'HOTLINE',
      condition_notes: null,
      evidence: [],
      damages: [],
    },
  });
  assert.equal(contract.termEndAt, '2027-03-31T17:00:00.000Z');
  assert.equal(contract.overduePenaltyPerDay, 33333);
  assert.deepEqual(contract.settlement, { ...settlement, lines: [] });
  assert.equal(contract.return.requestSource, 'HOTLINE');
  assert.equal(normaliseContract({ ...baseContract, settlement: {} }).settlement, null);
});

test('return request calls send the Vietnam day at noon UTC and the refund account', async () => {
  const calls = [];
  const { ContractsApi } = load('contracts-api.ts', async (path, init) => {
    calls.push({ path, init });
    return { id: 'r1' };
  });
  const refundAccount = {
    bankBin: '970436',
    bankName: 'Vietcombank',
    accountNo: '0123',
    accountName: 'A B',
  };
  await ContractsApi.returnPreview('c1', '2027-04-12');
  await ContractsApi.requestReturn('c1', { dayIso: '2027-04-12', note: '', refundAccount });
  await ContractsApi.updateReturn('c1', { note: '' });
  const cancelled = await ContractsApi.cancelReturn('c1');

  assert.equal(
    calls[0].path,
    '/contracts/c1/return-preview?scheduledAt=2027-04-12T12%3A00%3A00.000Z',
  );
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    scheduledAt: '2027-04-12T12:00:00.000Z',
    refundAccount,
  });
  // Omitted fields stay as they are; an empty note is sent so it clears.
  assert.equal(calls[2].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[2].init.body), { note: '' });
  assert.equal(calls[3].path, '/contracts/c1/return-request');
  assert.equal(calls[3].init.method, 'DELETE');
  assert.deepEqual(cancelled, { id: 'r1' });
});
