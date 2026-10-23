const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

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

const { rentableUnplacedShelves, shortShelfCode } = load(
  path.join(__dirname, '../src/features/customer/shelf-display.ts'),
);

test('shelves missing from the floor plan stay pickable; out-of-service ones are hidden', () => {
  const unplaced = [
    { id: 'a', status: 'AVAILABLE' },
    { id: 'b', status: 'RENTED' },
    { id: 'c', status: 'INACTIVE' },
  ];
  assert.deepEqual(
    rentableUnplacedShelves(unplaced, new Map()).map((s) => s.id),
    ['a', 'b'],
  );
});

test('the latest status from the shelf list wins over the layout snapshot', () => {
  const unplaced = [
    { id: 'a', status: 'AVAILABLE' },
    { id: 'b', status: 'AVAILABLE' },
  ];
  const latest = new Map([
    ['a', { id: 'a', status: 'HELD' }],
    ['b', { id: 'b', status: 'INACTIVE' }],
  ]);
  assert.deepEqual(rentableUnplacedShelves(unplaced, latest), [{ id: 'a', status: 'HELD' }]);
});

test('short code drops the warehouse prefix only', () => {
  assert.equal(shortShelfCode('HCM-KK-02-A-01', 'HCM-KK-02'), 'A-01');
  assert.equal(shortShelfCode('OTHER-01', 'HCM-KK-02'), 'OTHER-01');
});
