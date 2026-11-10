const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Loads lib/*.ts with './api' stubbed, like contracts-api.test.cjs.
function load(file, requestImpl) {
  const filename = path.join(__dirname, file);
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

test('options hits the options endpoint with the contract id', async () => {
  const calls = [];
  const { ChangeRequestsApi } = load('change-requests-api.ts', async (path, init) => {
    calls.push({ path, init });
    return { options: [{ unit: { id: 'u1' } }] };
  });
  const options = await ChangeRequestsApi.options('c-123');
  assert.equal(calls[0].path, '/unit-change-requests/options?contractId=c-123');
  assert.equal(options.length, 1);
});

test('create sends noon-UTC moveAt so the Vietnam day stays put', async () => {
  const calls = [];
  const { ChangeRequestsApi } = load('change-requests-api.ts', async (path, init) => {
    calls.push({ path, body: JSON.parse(init.body) });
    return { request: { id: 'r1' } };
  });
  const created = await ChangeRequestsApi.create({
    contractId: 'c1',
    newUnitId: 'u9',
    reason: '  cần rộng hơn  ',
    dayIso: '2026-11-20',
  });
  assert.equal(created.id, 'r1');
  assert.deepEqual(calls[0].body, {
    contractId: 'c1',
    newUnitId: 'u9',
    reason: '  cần rộng hơn  ',
    scheduledMoveAt: '2026-11-20T12:00:00.000Z',
  });
});

test('cancel posts to the cancel endpoint', async () => {
  const calls = [];
  const { ChangeRequestsApi } = load('change-requests-api.ts', async (path, init) => {
    calls.push({ path, method: init.method });
    return { request: { id: 'r1' } };
  });
  await ChangeRequestsApi.cancel('r1');
  assert.equal(calls[0].path, '/unit-change-requests/r1/cancel');
  assert.equal(calls[0].method, 'POST');
});

test('openChangeRequest returns the open one and ignores settled requests', () => {
  const { openChangeRequest } = load('change-requests-api.ts', async () => null);
  const rows = (statuses) => statuses.map((status, i) => ({ id: `r${i}`, status }));
  assert.equal(openChangeRequest(rows(['COMPLETED', 'CANCELLED'])), null);
  const open = openChangeRequest(rows(['COMPLETED', 'APPROVED', 'CANCELLED']));
  assert.equal(open.status, 'APPROVED');
  assert.equal(openChangeRequest(rows(['TRANSITIONING'])).status, 'TRANSITIONING');
  assert.equal(openChangeRequest(rows(['REQUESTED'])).status, 'REQUESTED');
});
