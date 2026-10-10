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
