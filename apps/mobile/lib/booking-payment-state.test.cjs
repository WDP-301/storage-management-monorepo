const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const BookingStatus = {
  DRAFT: 'DRAFT',
  HOLDING: 'HOLDING',
  PENDING_DEPOSIT: 'PENDING_DEPOSIT',
  CONFIRMED: 'CONFIRMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

// Compile the real modules in Node; only the workspace enum package is stubbed.
function loadTs(file, imports) {
  const filename = path.join(__dirname, file);
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name in imports) return imports[name];
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

const holdStateModule = loadTs('booking-hold-state.ts', {});
const { depositStage, selectPayableBookings, shouldPollDeposit } = loadTs(
  'booking-payment-state.ts',
  { '@storage/types': { BookingStatus }, './booking-hold-state': holdStateModule },
);

const NOW = Date.parse('2026-10-06T08:00:00.000Z');
const IN_TEN_MINUTES = new Date(NOW + 10 * 60_000).toISOString();
const TEN_MINUTES_AGO = new Date(NOW - 10 * 60_000).toISOString();
const QR = 'https://img.vietqr.io/image/MB-123-compact2.png?amount=1000000&addInfo=BK-1';

function booking(overrides) {
  return {
    id: 'b1',
    bookingNo: 'BK-1',
    status: BookingStatus.HOLDING,
    expiresAt: IN_TEN_MINUTES,
    paymentQrUrl: QR,
    depositTotal: '1000000.00',
    items: [],
    ...overrides,
  };
}

test('a live hold with a QR can be paid', () => {
  assert.equal(depositStage(booking(), NOW), 'awaiting');
});

test('PENDING_DEPOSIT is payable too, matching the API awaiting-deposit statuses', () => {
  assert.equal(depositStage(booking({ status: BookingStatus.PENDING_DEPOSIT }), NOW), 'awaiting');
});

test('a confirmed booking is paid even while its QR lingers in a stale response', () => {
  assert.equal(depositStage(booking({ status: BookingStatus.CONFIRMED }), NOW), 'paid');
});

test('the window closes once the deadline passes, before the API catches up', () => {
  // The booking still says HOLDING with a QR: only the local clock knows the hold just lapsed.
  assert.equal(depositStage(booking({ expiresAt: TEN_MINUTES_AGO }), NOW), 'closed');
});

test('a booking with no deadline is not payable', () => {
  assert.equal(depositStage(booking({ expiresAt: null }), NOW), 'closed');
});

test('expired and cancelled bookings are closed', () => {
  assert.equal(depositStage(booking({ status: BookingStatus.EXPIRED }), NOW), 'closed');
  assert.equal(depositStage(booking({ status: BookingStatus.CANCELLED }), NOW), 'closed');
});

test('a live hold without a QR means the API has no bank account configured', () => {
  assert.equal(depositStage(booking({ paymentQrUrl: null }), NOW), 'unavailable');
});

test('polling continues only while the outcome can still change on its own', () => {
  assert.equal(shouldPollDeposit('awaiting'), true);
  assert.equal(shouldPollDeposit('unavailable'), true);
  assert.equal(shouldPollDeposit('paid'), false);
  assert.equal(shouldPollDeposit('closed'), false);
});

test('payable bookings come back soonest-deadline-first', () => {
  const later = booking({
    id: 'later',
    expiresAt: new Date(NOW + 12 * 60_000).toISOString(),
  });
  const sooner = booking({ id: 'sooner', expiresAt: new Date(NOW + 2 * 60_000).toISOString() });
  const lapsed = booking({ id: 'lapsed', expiresAt: TEN_MINUTES_AGO });
  const confirmed = booking({ id: 'confirmed', status: BookingStatus.CONFIRMED });

  assert.deepEqual(
    selectPayableBookings([later, lapsed, sooner, confirmed], NOW).map((b) => b.id),
    ['sooner', 'later'],
  );
});
