const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file) {
  const filename = path.join(__dirname, file);
  const mod = new Module(filename);
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports;
}

const { splitBySize, handoverBlockedReason, MAX_CONTRACT_FILE_BYTES } = load('contract-files.ts');
const file = (name, size) => ({ uri: `file:///${name}`, name, mimeType: 'image/jpeg', size });

test('splitBySize rejects files above the limit and keeps unknown sizes', () => {
  const { accepted, tooLarge } = splitBySize([
    file('ok.jpg', MAX_CONTRACT_FILE_BYTES),
    file('big.jpg', MAX_CONTRACT_FILE_BYTES + 1),
    file('unknown.jpg', undefined),
  ]);
  assert.deepEqual(
    accepted.map((f) => f.name),
    ['ok.jpg', 'unknown.jpg'],
  );
  assert.deepEqual(
    tooLarge.map((f) => f.name),
    ['big.jpg'],
  );
});

test('handoverBlockedReason blocks without files or while saving, otherwise allows', () => {
  assert.match(handoverBlockedReason(0, false), /file hợp đồng/);
  assert.match(handoverBlockedReason(2, true), /Đang lưu/);
  assert.equal(handoverBlockedReason(2, false), undefined);
});
