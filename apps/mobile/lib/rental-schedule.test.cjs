const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// rental-schedule has no imports, so it compiles standalone.
function load() {
  const filename = path.join(__dirname, 'rental-schedule.ts');
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

const { latestStartIso, monthStartsBetween } = load();

test('latest start date is leadDays after today', () => {
  assert.equal(latestStartIso(30, '2026-10-19'), '2026-11-18');
  assert.equal(latestStartIso(14, '2026-10-19'), '2026-11-02');
  assert.equal(latestStartIso(0, '2026-10-19'), '2026-10-19');
});

test('latest start date rolls across month and year ends', () => {
  assert.equal(latestStartIso(30, '2027-01-31'), '2027-03-02');
  assert.equal(latestStartIso(60, '2026-12-15'), '2027-02-13');
});

test('month starts cover every month from today to the latest start date', () => {
  assert.deepEqual(monthStartsBetween('2026-10-19', '2026-10-25'), ['2026-10-01']);
  assert.deepEqual(monthStartsBetween('2026-10-19', '2026-11-18'), ['2026-10-01', '2026-11-01']);
  assert.deepEqual(monthStartsBetween('2026-11-30', '2027-02-01'), [
    '2026-11-01',
    '2026-12-01',
    '2027-01-01',
    '2027-02-01',
  ]);
});
