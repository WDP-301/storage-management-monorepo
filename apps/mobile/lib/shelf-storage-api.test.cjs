const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Loads lib/shelf-storage-api.ts with './api' stubbed and './evidence' compiled for real.
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

function setup(responder = async () => ({})) {
  const calls = [];
  const { ShelfStorageApi, normaliseReceipt } = load('shelf-storage-api.ts', async (url, init) => {
    calls.push({ url, init });
    return responder(url, init);
  });
  return { api: ShelfStorageApi, normaliseReceipt, calls };
}

const photo = { fileKey: 'uploads/a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' };
const receipt = (photos) => ({ id: 'r1', code: 'PG-1', photos, lines: [] });

test('only photos with a file key survive normalisation', () => {
  const { normaliseReceipt } = setup();
  const result = normaliseReceipt(receipt([photo, 'https://old.example/x.jpg', null, {}]));
  assert.deepEqual(result.photos, [photo]);
  assert.deepEqual(normaliseReceipt(receipt(undefined)).photos, []);
});

test('routes map to the contract paths and verbs', async () => {
  // One response shape that satisfies every normaliser: a receipt, a page and a session at once.
  const { api, calls } = setup(async () => ({ ...receipt([]), receipts: [], contracts: [] }));
  await api.openSession({ qrPayload: 'SMCI1:x', warehouseId: 'w1' });
  await api.createReceipt({ clientRequestId: 'k' });
  await api.voidReceipt('r 1', { reason: 'sai' });
  await api.warehouseReceipts('w1', 2, 10, '  an ');
  await api.contractReceipts('c1');
  await api.createPickupRequest('c1', { lines: [], requestedFor: 'x' });
  await api.cancelPickupRequest('p1');
  await api.warehousePickupRequests('w1');
  await api.warehousePickupRequests('w1', 'ALL');
  await api.markPickupReady('p1');
  await api.abandonedContracts('w1');
  await api.createRecovery({ clientRequestId: 'k' });
  await api.contractStorage('c1');
  await api.contractPickupRequests('c1');
  await api.getReceipt('r1');
  await api.getSession('s1');

  const seen = calls.map(({ url, init }) => `${init?.method ?? 'GET'} ${url}`);
  assert.deepEqual(seen, [
    'POST /shelf-storage/sessions',
    'POST /shelf-storage/receipts',
    'POST /shelf-storage/receipts/r%201/void',
    'GET /shelf-storage/warehouses/w1/receipts?page=2&limit=10&search=an',
    'GET /shelf-storage/contracts/c1/receipts?page=1&limit=20',
    'POST /shelf-storage/contracts/c1/pickup-requests',
    'POST /shelf-storage/pickup-requests/p1/cancel',
    'GET /shelf-storage/warehouses/w1/pickup-requests?status=OPEN',
    'GET /shelf-storage/warehouses/w1/pickup-requests?status=ALL',
    'POST /shelf-storage/pickup-requests/p1/ready',
    'GET /shelf-storage/warehouses/w1/abandoned-contracts',
    'POST /shelf-storage/recoveries',
    'GET /shelf-storage/contracts/c1',
    'GET /shelf-storage/contracts/c1/pickup-requests',
    'GET /shelf-storage/receipts/r1',
    'GET /shelf-storage/sessions/s1',
  ]);
  assert.equal(calls[0].init.body, JSON.stringify({ qrPayload: 'SMCI1:x', warehouseId: 'w1' }));
});

test('a session response has its recent receipts normalised', async () => {
  const { api } = setup(async () => ({
    sessionId: 's1',
    contracts: [{ contractId: 'c1', recentReceipts: [receipt([photo, 'junk'])] }],
  }));
  const session = await api.openSession({ qrPayload: 'x', warehouseId: 'w' });
  assert.deepEqual(session.contracts[0].recentReceipts[0].photos, [photo]);
});

test('scan warehouses keep only shelf warehouses and their facility', async () => {
  const facility = { id: 'f1', code: 'F', name: 'Chi nhánh' };
  const { api, calls } = setup(async () => [
    { id: 'w1', code: 'W1', name: 'Kho kệ', kind: 'SHELF_WAREHOUSE', facility, extra: 1 },
    { id: 'w2', code: 'W2', name: 'Kho thường', kind: 'SELF_STORAGE', facility },
  ]);
  assert.deepEqual(await api.scanWarehouses(), [
    { id: 'w1', code: 'W1', name: 'Kho kệ', facility },
  ]);
  assert.equal(calls[0].url, '/warehouses/mine');
});

test('a failed request is not swallowed', async () => {
  const { api } = setup(async () => {
    throw new Error('offline');
  });
  await assert.rejects(api.getReceipt('r1'), /offline/);
});
