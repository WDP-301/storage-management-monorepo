const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// booking-hold-state only imports a type, so it compiles with no runtime dependencies to stub.
function loadHoldState() {
  const filename = path.join(__dirname, 'booking-hold-state.ts');
  const mod = new Module(filename);
  mod.require = (name) => {
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

const { formatRemaining } = loadHoldState();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

test('short holds count down in mm:ss', () => {
  assert.equal(formatRemaining(14 * MINUTE + 13 * SECOND), '14:13');
  assert.equal(formatRemaining(5 * SECOND), '00:05');
});

test('an overshoot floors at zero instead of going negative', () => {
  assert.equal(formatRemaining(-1 * MINUTE), '00:00');
  assert.equal(formatRemaining(0), '00:00');
});

test('a day-long hold reads as hours, not as 1439 minutes', () => {
  // The regression: booking.hold_minutes is an admin setting that goes up to 1440, and mm:ss
  // rendered a 24h hold as "1439:42" — a number nobody parses as a day.
  assert.equal(formatRemaining(24 * HOUR - 18 * SECOND), '23h 59m');
  assert.equal(formatRemaining(24 * HOUR), '24h 00m');
});

test('the switch to hours happens exactly at one hour', () => {
  assert.equal(formatRemaining(HOUR - SECOND), '59:59');
  assert.equal(formatRemaining(HOUR), '1h 00m');
});

test('minutes stay two digits past the hour mark', () => {
  assert.equal(formatRemaining(2 * HOUR + 5 * MINUTE), '2h 05m');
});
