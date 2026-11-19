const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Compiles a .ts file and, recursively, the relative .ts files it imports; nothing else is allowed.
function load(filename) {
  const mod = new Module(filename);
  mod.require = (name) => {
    if (!name.startsWith('.')) throw new Error(`Unexpected import: ${name}`);
    return load(path.resolve(path.dirname(filename), `${name}.ts`));
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports;
}

const { renewalToShow, canRequestRenewal } = load(
  path.join(__dirname, 'contract-renewal-state.ts'),
);

const renewal = (id, status, createdAt, contractId = 'c-1') => ({
  id,
  contract_id: contractId,
  status,
  created_at: createdAt,
});

test('a pending renewal is shown before anything else', () => {
  const rows = [
    renewal('r-1', 'REJECTED', '2026-11-10T00:00:00.000Z'),
    renewal('r-2', 'PENDING', '2026-11-01T00:00:00.000Z'),
  ];
  assert.equal(renewalToShow(rows, 'c-1').id, 'r-2');
});

test('the latest rejection is shown until a later approval replaces it', () => {
  const rejected = renewal('r-1', 'REJECTED', '2026-11-01T00:00:00.000Z');
  assert.equal(renewalToShow([rejected], 'c-1').id, 'r-1');
  const approved = renewal('r-2', 'APPROVED', '2026-11-05T00:00:00.000Z');
  assert.equal(renewalToShow([rejected, approved], 'c-1'), null);
});

test('a withdrawn request does not hide an earlier rejection, and other contracts are ignored', () => {
  const rows = [
    renewal('r-1', 'REJECTED', '2026-11-01T00:00:00.000Z'),
    renewal('r-2', 'CANCELLED', '2026-11-05T00:00:00.000Z'),
    renewal('r-3', 'PENDING', '2026-11-06T00:00:00.000Z', 'c-2'),
  ];
  assert.equal(renewalToShow(rows, 'c-1').id, 'r-1');
  assert.equal(renewalToShow([], 'c-1'), null);
});

test('renewing needs an active contract before its term end day, with nothing else open', () => {
  const base = {
    isActive: true,
    todayIso: '2027-01-09',
    termEndDayIso: '2027-01-10',
    hasOpenReturn: false,
    hasOpenChange: false,
    hasPendingRenewal: false,
  };
  assert.equal(canRequestRenewal(base), true);
  assert.equal(canRequestRenewal({ ...base, todayIso: '2027-01-10' }), false);
  assert.equal(canRequestRenewal({ ...base, termEndDayIso: null }), false);
  assert.equal(canRequestRenewal({ ...base, isActive: false }), false);
  assert.equal(canRequestRenewal({ ...base, hasOpenReturn: true }), false);
  assert.equal(canRequestRenewal({ ...base, hasOpenChange: true }), false);
  assert.equal(canRequestRenewal({ ...base, hasPendingRenewal: true }), false);
});
