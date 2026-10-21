const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// notifications-api imports only types besides './api', which gets stubbed.
function loadNotificationsApi(requestImpl) {
  const filename = path.join(__dirname, 'notifications-api.ts');
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

const record = (id, data) => ({ id, type: 'RETURN_FINALIZED', data });

test('list requests the page and only adds unreadOnly when asked', async () => {
  const paths = [];
  const { NotificationsApi } = loadNotificationsApi(async (path) => {
    paths.push(path);
    return { notifications: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } };
  });

  await NotificationsApi.list(2);
  await NotificationsApi.list(1, true);

  assert.deepEqual(paths, ['/notifications?page=2', '/notifications?page=1&unreadOnly=true']);
});

test('list guarantees every record carries a data object', async () => {
  const { NotificationsApi } = loadNotificationsApi(async () => ({
    notifications: [record('a', null), record('b', ['x']), record('c', { contractId: 'c-1' })],
    meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
  }));

  const { notifications, meta } = await NotificationsApi.list(1);

  assert.deepEqual(
    notifications.map((n) => n.data),
    [{}, {}, { contractId: 'c-1' }],
  );
  assert.equal(meta.total, 3);
});

test('unreadCount unwraps the envelope and never goes negative or fractional', async () => {
  const replies = [{ unread: 7 }, { unread: -3 }, { unread: 2.9 }, { unread: Number.NaN }];
  const calls = [];
  const { NotificationsApi } = loadNotificationsApi(async (path) => {
    calls.push(path);
    return replies.shift();
  });

  assert.equal(await NotificationsApi.unreadCount(), 7);
  assert.equal(await NotificationsApi.unreadCount(), 0);
  assert.equal(await NotificationsApi.unreadCount(), 2);
  assert.equal(await NotificationsApi.unreadCount(), 0);
  assert.equal(calls[0], '/notifications/unread-count');
});

test('markRead PATCHes the notification and returns the updated record', async () => {
  const calls = [];
  const { NotificationsApi } = loadNotificationsApi(async (path, init) => {
    calls.push({ path, init });
    return { notification: { ...record('n-1', {}), read_at: '2026-10-21T01:00:00.000Z' } };
  });

  const updated = await NotificationsApi.markRead('n-1');

  assert.equal(calls[0].path, '/notifications/n-1/read');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(updated.read_at, '2026-10-21T01:00:00.000Z');
});

test('markAllRead PATCHes read-all and returns how many were updated', async () => {
  const calls = [];
  const { NotificationsApi } = loadNotificationsApi(async (path, init) => {
    calls.push({ path, init });
    return { updated: 4 };
  });

  assert.equal(await NotificationsApi.markAllRead(), 4);
  assert.equal(calls[0].path, '/notifications/read-all');
  assert.equal(calls[0].init.method, 'PATCH');
});

test('request failures propagate to the caller', async () => {
  const { NotificationsApi } = loadNotificationsApi(async () => {
    throw new Error('offline');
  });

  await assert.rejects(() => NotificationsApi.markRead('n-1'), /offline/);
});
