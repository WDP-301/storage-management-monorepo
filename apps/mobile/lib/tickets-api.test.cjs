const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// tickets-api imports only types besides './api' and 'expo-crypto' — both get stubbed.
function loadTicketsApi(requestImpl) {
  const filename = path.join(__dirname, 'tickets-api.ts');
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name === './api') return { request: requestImpl };
    if (name === 'expo-crypto') return { randomUUID: () => 'uuid-fixed' };
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

test('listMine builds the query string from page/limit/status', async () => {
  const calls = [];
  const { TicketsApi } = loadTicketsApi(async (path, init) => {
    calls.push({ path, init });
    return { tickets: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } };
  });

  const res = await TicketsApi.listMine({ page: 2, limit: 10, status: 'OPEN' });

  assert.equal(calls[0].path, '/service-tickets?page=2&limit=10&status=OPEN');
  assert.equal(res.meta.page, 2);
});

test('listMine without params hits the bare path', async () => {
  const calls = [];
  const { TicketsApi } = loadTicketsApi(async (path) => {
    calls.push(path);
    return { tickets: [], meta: {} };
  });

  await TicketsApi.listMine();

  assert.equal(calls[0], '/service-tickets');
});

test('create sends the idempotency key header and JSON body', async () => {
  const calls = [];
  const { TicketsApi } = loadTicketsApi(async (path, init) => {
    calls.push({ path, init });
    return { ticket: { id: 't-1' } };
  });

  const input = { typeId: 'ty-1', facilityId: 'f-1', subject: 'S', description: 'D' };
  const ticket = await TicketsApi.create(input, 'uuid-fixed');

  assert.equal(calls[0].path, '/service-tickets');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'uuid-fixed');
  assert.deepEqual(JSON.parse(calls[0].init.body), input);
  assert.equal(ticket.id, 't-1');
});

test('getById and formOptions unwrap their envelopes', async () => {
  const { TicketsApi } = loadTicketsApi(async (path) =>
    path === '/service-tickets/form-options'
      ? { options: { types: [], facilities: [] } }
      : { ticket: { id: 't-9' } },
  );

  assert.equal((await TicketsApi.getById('t-9')).id, 't-9');
  assert.deepEqual(await TicketsApi.formOptions(), { types: [], facilities: [] });
});

test('cancel PATCHes the cancel endpoint and returns the ticket', async () => {
  const calls = [];
  const { TicketsApi } = loadTicketsApi(async (path, init) => {
    calls.push({ path, init });
    return { ticket: { id: 't-1', status: 'CANCELLED' } };
  });

  const ticket = await TicketsApi.cancel('t-1');

  assert.equal(calls[0].path, '/service-tickets/t-1/cancel');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(ticket.status, 'CANCELLED');
});
