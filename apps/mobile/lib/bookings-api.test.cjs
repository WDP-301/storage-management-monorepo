const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Exercise the API boundary without loading native Expo modules in Node.
function loadApi(response) {
  const filename = path.join(__dirname, 'bookings-api.ts');
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name === 'expo-crypto') return { randomUUID: () => 'test-key' };
    if (name === './api') {
      return {
        request: async (url) => {
          assert.equal(url, '/bookings/me');
          return response;
        },
      };
    }
    throw new Error(`Unexpected import: ${name}`);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports.BookingsApi;
}

test('GET holdExpiresAt becomes the same countdown deadline as POST expiresAt', async () => {
  const deadline = '2026-10-03T07:05:00.000Z';
  const response = [{ id: 'new', status: 'HOLDING', holdExpiresAt: deadline, items: [] }];
  const [booking] = await loadApi(response).listMine();
  assert.equal(booking.expiresAt, deadline);
  assert.equal(Date.parse(booking.expiresAt) - Date.parse('2026-10-03T06:50:00Z'), 900000);
  assert.equal(response[0].holdExpiresAt, deadline);
});

test('legacy expiresAt remains supported', async () => {
  const response = [{ id: 'legacy', expiresAt: '2026-10-03T07:05:00Z' }];
  assert.deepEqual(await loadApi(response).listMine(), response);
});

test('explicit null from GET overrides an older deadline', async () => {
  const [booking] = await loadApi([
    { holdExpiresAt: null, expiresAt: '2026-10-03T07:05:00Z' },
  ]).listMine();
  assert.equal(booking.expiresAt, null);
});

test('a missing deadline on another booking does not discard the active booking', async () => {
  const deadline = '2026-10-03T07:05:00Z';
  const result = await loadApi([
    { id: 'active', holdExpiresAt: deadline },
    { id: 'unknown', status: 'HOLDING' },
    { id: 'expired', status: 'EXPIRED', holdExpiresAt: null },
  ]).listMine();
  assert.deepEqual(
    result.map((booking) => booking.expiresAt),
    [deadline, null, null],
  );
});
