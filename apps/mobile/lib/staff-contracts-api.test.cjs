const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Loads a lib/*.ts module with './api' stubbed; sibling modules compile for real.
function load(file, requestImpl) {
  const filename = path.join(__dirname, file);
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name === './api') return { request: requestImpl };
    if (name === './evidence') return load('evidence.ts', requestImpl);
    if (name === './contracts-api') return load('contracts-api.ts', requestImpl);
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

const response = {
  id: 'c1',
  contract_no: 'HD-001',
  kind: 'RENTAL',
  status: 'DRAFT',
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
  documents: [{ fileKey: 'uploads/a.pdf', name: 'a.pdf', mimeType: 'application/pdf' }],
  customer: { id: 'u1', full_name: 'Nguyễn An', phone: '0901234567' },
  permissions: { documents: true, handover: true, return: false },
};

test('normaliseStaffContract maps customer, permissions and shared contract fields', () => {
  const { normaliseStaffContract } = load('staff-contracts-api.ts', async () => null);
  const contract = normaliseStaffContract(response);
  assert.equal(contract.contractNo, 'HD-001');
  assert.equal(contract.monthlyPrice, 1000000);
  assert.equal(contract.documents.length, 1);
  assert.deepEqual(contract.customer, { id: 'u1', fullName: 'Nguyễn An', phone: '0901234567' });
  assert.deepEqual(contract.permissions, { documents: true, handover: true, return: false });
});

test('normaliseStaffContract treats missing permissions and names as no access', () => {
  const { normaliseStaffContract } = load('staff-contracts-api.ts', async () => null);
  const contract = normaliseStaffContract({
    ...response,
    customer: { id: 'u1', full_name: null, phone: null },
    permissions: { documents: 'yes' },
  });
  assert.deepEqual(contract.permissions, { documents: false, handover: false, return: false });
  assert.equal(contract.customer.fullName, 'Khách hàng');
  assert.equal(contract.customer.phone, null);
});

test('StaffContractsApi.get requests the staff view of the contract', async () => {
  const calls = [];
  const { StaffContractsApi } = load('staff-contracts-api.ts', async (p) => {
    calls.push(p);
    return response;
  });
  const contract = await StaffContractsApi.get('c1');
  assert.equal(calls[0], '/contracts/c1/staff-view');
  assert.equal(contract.id, 'c1');
});
