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

const { notificationDisplay, notificationHref, formatRelativeTime } = load(
  path.join(__dirname, '../src/features/notifications/notification-display.ts'),
);

const NOW = Date.parse('2026-10-21T10:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test('every notification type has its own label and a type unknown to this build falls back', () => {
  for (const type of [
    'TICKET_CREATED',
    'TICKET_UPDATED',
    'TICKET_ASSIGNED',
    'INVOICE_ISSUED',
    'INVOICE_PAID',
    'RETURN_FINALIZED',
    'SETTLEMENT_APPROVED',
    'REFUND_COMPLETED',
    'CONTRACT_TERM_ENDING',
    'CONTRACT_OVERDUE',
    'CHECK_OUT_MISSED',
  ]) {
    assert.notEqual(notificationDisplay(type).icon, 'default', type);
  }
  assert.equal(notificationDisplay('CONTRACT_OVERDUE').tone, 'danger');
  assert.deepEqual(notificationDisplay('SOMETHING_NEW'), {
    label: 'Thông báo',
    icon: 'default',
    tone: 'neutral',
  });
  // Inherited object keys must not be mistaken for a known type.
  assert.equal(notificationDisplay('constructor').icon, 'default');
});

test('contract notifications open the contract and ticket notifications open the ticket', () => {
  assert.equal(
    notificationHref({ contractId: 'c-1', contractNo: 'HD-1' }),
    '/(customer)/contract-detail?id=c-1',
  );
  assert.equal(notificationHref({ ticketId: 't-9' }), '/(customer)/ticket-detail?id=t-9');
  assert.equal(
    notificationHref({ contractId: 'c-1', ticketId: 't-9' }),
    '/(customer)/contract-detail?id=c-1',
  );
});

test('staff notifications open the staff screens, never the customer ones', () => {
  assert.equal(notificationHref({ ticketId: 't-9' }, 'staff'), '/(staff)/staff-ticket?id=t-9');
  assert.equal(notificationHref({ contractId: 'c-1' }, 'staff'), '/(staff)/staff-contract?id=c-1');
  assert.equal(notificationHref({ invoiceId: 'i-1' }, 'staff'), null);
});

test('notifications without a usable target resolve to no route', () => {
  assert.equal(notificationHref({}), null);
  assert.equal(notificationHref({ invoiceId: 'i-1' }), null);
  assert.equal(notificationHref({ contractId: '   ', ticketId: 42 }), null);
  assert.equal(notificationHref({ contractId: null }), null);
});

test('ids are encoded so they cannot add query parameters', () => {
  assert.equal(
    notificationHref({ contractId: 'a&b=1' }),
    '/(customer)/contract-detail?id=a%26b%3D1',
  );
});

test('relative time steps from minutes to days', () => {
  assert.equal(formatRelativeTime(ago(20_000), NOW), 'Vừa xong');
  assert.equal(formatRelativeTime(ago(5 * MINUTE), NOW), '5 phút trước');
  assert.equal(formatRelativeTime(ago(59 * MINUTE + 59_000), NOW), '59 phút trước');
  assert.equal(formatRelativeTime(ago(HOUR), NOW), '1 giờ trước');
  assert.equal(formatRelativeTime(ago(23 * HOUR), NOW), '23 giờ trước');
  assert.equal(formatRelativeTime(ago(DAY), NOW), '1 ngày trước');
  assert.equal(formatRelativeTime(ago(6 * DAY), NOW), '6 ngày trước');
});

test('relative time shows the full date after a week, and tolerates bad or future input', () => {
  const week = formatRelativeTime(ago(7 * DAY), NOW);
  assert.match(week, /^\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}$/);
  assert.equal(formatRelativeTime('not a date', NOW), '');
  assert.equal(formatRelativeTime(new Date(NOW + 5 * MINUTE).toISOString(), NOW), 'Vừa xong');
});
