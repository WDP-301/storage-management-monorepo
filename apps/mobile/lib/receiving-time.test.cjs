const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// receiving-time only uses plain data, so it loads with no runtime dependencies to stub.
function load() {
  const filename = path.join(__dirname, 'receiving-time.ts');
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

const t = load();

// 08:00–17:00 Vietnam = 01:00Z–10:00Z.
const DAY = {
  date: '2027-03-10',
  windows: [{ startAt: '2027-03-10T01:00:00.000Z', endAt: '2027-03-10T10:00:00.000Z' }],
};

test('formatVnTime renders an instant in Vietnam time', () => {
  assert.equal(t.formatVnTime('2027-03-10T01:00:00.000Z'), '08:00');
  assert.equal(t.formatVnTime('2027-03-10T09:30:00.000Z'), '16:30');
});

test('timeOptionsForDate lists on-the-hour slots inside the window', () => {
  const options = t.timeOptionsForDate([DAY], '2027-03-10');
  assert.equal(options.length, 9); // 08:00 … 16:00
  assert.deepEqual(options[0], { value: '2027-03-10T01:00:00.000Z', label: '08:00' });
  assert.deepEqual(options.at(-1), { value: '2027-03-10T09:00:00.000Z', label: '16:00' });
});

test('timeOptionsForDate begins at the next step when the window is trimmed to now', () => {
  const trimmed = {
    date: '2027-03-10',
    windows: [{ startAt: '2027-03-10T07:47:00.000Z', endAt: '2027-03-10T10:00:00.000Z' }],
  };
  const options = t.timeOptionsForDate([trimmed], '2027-03-10');
  assert.deepEqual(options[0], { value: '2027-03-10T08:00:00.000Z', label: '15:00' });
});

test('timeOptionsForDate rounds a last-hour window trimmed to now up to the quarter hour', () => {
  // Fetched at 16:05:12 VN with the shift ending at 17:00 — never offer the (past) fetch instant.
  const trimmed = [
    {
      date: '2026-11-20',
      windows: [{ startAt: '2026-11-20T09:05:12.345Z', endAt: '2026-11-20T10:00:00.000Z' }],
    },
  ];
  assert.deepEqual(t.timeOptionsForDate(trimmed, '2026-11-20'), [
    { value: '2026-11-20T09:15:00.000Z', label: '16:15' },
  ]);
  const closing = [
    {
      date: '2026-11-20',
      windows: [{ startAt: '2026-11-20T09:50:00.000Z', endAt: '2026-11-20T10:00:00.000Z' }],
    },
  ];
  assert.deepEqual(t.timeOptionsForDate(closing, '2026-11-20'), []);
});

test('timeOptionsForDate is empty for a day without windows', () => {
  assert.deepEqual(t.timeOptionsForDate([DAY], '2027-03-11'), []);
});

test('defaultInstant is the first slot, or null', () => {
  assert.equal(t.defaultInstant([DAY], '2027-03-10'), '2027-03-10T01:00:00.000Z');
  assert.equal(t.defaultInstant([DAY], '2027-03-11'), null);
});

test('isWithinWindows counts the start but not the end', () => {
  assert.equal(t.isWithinWindows([DAY], '2027-03-10', '2027-03-10T01:00:00.000Z'), true);
  assert.equal(t.isWithinWindows([DAY], '2027-03-10', '2027-03-10T10:00:00.000Z'), false);
  assert.equal(t.isWithinWindows([DAY], '2027-03-10', '2027-03-10T00:30:00.000Z'), false);
});
