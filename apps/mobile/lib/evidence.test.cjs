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

const photo = { fileKey: 'uploads/a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' };

test('toStaffDamages keeps whole non-negative fees and maps anything else to null', () => {
  const { toStaffDamages } = load('evidence.ts');
  const damage = (proposedFee) => ({ description: 'Móp cửa', severity: 'MINOR', proposedFee });
  const fees = [500000, 0, -1, 1.5, '500000', null, undefined, Number.NaN].map(
    (fee) => toStaffDamages([damage(fee)])[0].proposedFee,
  );
  assert.deepEqual(fees, [500000, 0, null, null, null, null, null, null]);
});

test('toStaffDamages keeps evidence, drops malformed entries and keeps fees aligned', () => {
  const { toStaffDamages } = load('evidence.ts');
  const result = toStaffDamages([
    'broken',
    {
      description: 'Nứt tường',
      severity: 'MAJOR',
      evidence: [photo, 'old-url'],
      proposedFee: 2000000,
    },
    null,
    { description: 'Xước sàn', severity: 'MINOR', proposedFee: 100000 },
  ]);
  assert.deepEqual(result, [
    { description: 'Nứt tường', severity: 'MAJOR', evidence: [photo], proposedFee: 2000000 },
    { description: 'Xước sàn', severity: 'MINOR', evidence: [], proposedFee: 100000 },
  ]);
  assert.deepEqual(toStaffDamages(null), []);
});

test('toDamages never exposes the proposed fee to customer views', () => {
  const { toDamages } = load('evidence.ts');
  const [damage] = toDamages([{ description: 'Móp cửa', severity: 'MINOR', proposedFee: 500000 }]);
  assert.equal('proposedFee' in damage, false);
});
