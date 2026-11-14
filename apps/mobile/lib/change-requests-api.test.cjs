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

test('create sends the chosen move instant as scheduledMoveAt', async () => {
  const calls = [];
  const { ChangeRequestsApi } = load('change-requests-api.ts', async (path, init) => {
    calls.push({ path, body: JSON.parse(init.body) });
    return { request: { id: 'r1' } };
  });
  const created = await ChangeRequestsApi.create({
    contractId: 'c1',
    newUnitId: 'u9',
    reason: '  cần rộng hơn  ',
    moveAt: '2026-11-20T02:00:00.000Z',
  });
  assert.equal(created.id, 'r1');
  assert.deepEqual(calls[0].body, {
    contractId: 'c1',
    newUnitId: 'u9',
    reason: '  cần rộng hơn  ',
    scheduledMoveAt: '2026-11-20T02:00:00.000Z',
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
  assert.equal(openChangeRequest(rows(['COMPLETED', 'CANCELLED', 'REJECTED'])), null);
  const open = openChangeRequest(rows(['COMPLETED', 'AWAITING_PAYMENT', 'CANCELLED']));
  assert.equal(open.status, 'AWAITING_PAYMENT');
  assert.equal(openChangeRequest(rows(['AWAITING_HANDOVER'])).status, 'AWAITING_HANDOVER');
  assert.equal(
    openChangeRequest(rows(['AWAITING_FINAL_APPROVAL'])).status,
    'AWAITING_FINAL_APPROVAL',
  );
  assert.equal(openChangeRequest(rows(['REQUESTED'])).status, 'REQUESTED');
  // Legacy statuses are no longer open, even though old rows may still carry them.
  assert.equal(openChangeRequest(rows(['APPROVED'])), null);
  assert.equal(openChangeRequest(rows(['TRANSITIONING'])), null);
});

test('CHANGE_REQUEST_OPEN_STATUSES mirrors the four open statuses', () => {
  const { CHANGE_REQUEST_OPEN_STATUSES } = load('change-requests-api.ts', async () => null);
  assert.deepEqual(CHANGE_REQUEST_OPEN_STATUSES, [
    'REQUESTED',
    'AWAITING_PAYMENT',
    'AWAITING_HANDOVER',
    'AWAITING_FINAL_APPROVAL',
  ]);
});
