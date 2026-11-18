const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file) {
  const filename = path.join(__dirname, file);
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

const { groupShelfOptions, signedDifference } = load('shelf-change.ts');
const option = (id) => ({ unit: { id } });

test('groups options by the warehouse that holds them and keeps the rest as orphans', () => {
  const { groups, orphans } = groupShelfOptions(
    [
      { warehouse: { id: 'w1' }, shelfIds: ['s1', 's2'] },
      { warehouse: { id: 'w2' }, shelfIds: ['s3'] },
      { warehouse: { id: 'w3' }, shelfIds: ['s9'] },
    ],
    [option('s3'), option('s1'), option('s7'), option('s2')],
    null,
  );
  assert.deepEqual(
    groups.map((group) => [group.warehouse.id, group.optionIds]),
    [
      ['w1', ['s1', 's2']],
      ['w2', ['s3']],
    ],
  );
  assert.deepEqual(
    orphans.map((item) => item.unit.id),
    ['s7'],
  );
});

test('puts the current warehouse first and ignores duplicate warehouses', () => {
  const { groups } = groupShelfOptions(
    [
      { warehouse: { id: 'w1' }, shelfIds: ['s1'] },
      { warehouse: { id: 'w2' }, shelfIds: ['s2'] },
      { warehouse: { id: 'w2' }, shelfIds: ['s2'] },
    ],
    [option('s1'), option('s2')],
    'w2',
  );
  assert.deepEqual(
    groups.map((group) => group.warehouse.id),
    ['w2', 'w1'],
  );
});

test('signedDifference shows a sign only for non-zero differences', () => {
  const format = (amount) => `${amount}đ`;
  assert.equal(signedDifference(0, format), '');
  assert.equal(signedDifference(5, format), '+5đ');
  assert.equal(signedDifference(-5, format), '−5đ');
});
