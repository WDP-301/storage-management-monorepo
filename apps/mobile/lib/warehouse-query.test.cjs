const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// warehouse-query only imports types, so it loads with no runtime dependencies to stub.
function load() {
  const filename = path.join(__dirname, 'warehouse-query.ts');
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

const q = load();
const base = q.DEFAULT_BROWSE_CRITERIA;
const params = (query) => Object.fromEntries(new URLSearchParams(query));

test('default criteria send only sort and paging', () => {
  assert.deepEqual(params(q.buildWarehouseQuery(base)), {
    sort: 'price_asc',
    page: '1',
    limit: '20',
  });
});

test('presets map onto min/max params for area, volume and price', () => {
  const query = q.buildWarehouseQuery(
    { ...base, areaPreset: 's', volumePreset: 'l', pricePreset: 'xs', sort: 'area_desc' },
    3,
    50,
  );
  assert.deepEqual(params(query), {
    minArea: '10',
    maxArea: '30',
    minVolume: '300',
    maxPrice: '3000000',
    sort: 'area_desc',
    page: '3',
    limit: '50',
  });
});

test('province and ward codes are passed through', () => {
  const p = params(q.buildWarehouseQuery({ ...base, provinceCode: '79', wardCode: '26740' }));
  assert.equal(p.provinceCode, '79');
  assert.equal(p.wardCode, '26740');
});

test('matchesCriteria mirrors the server bounds inclusively', () => {
  const w = {
    areaM2: 10,
    volumeM3: 30,
    monthlyPrice: 3_000_000,
    provinceCode: '79',
    wardCode: 'a',
  };
  assert.equal(q.matchesCriteria(w, { ...base, areaPreset: 'xs', pricePreset: 'xs' }), true);
  assert.equal(q.matchesCriteria(w, { ...base, areaPreset: 'm' }), false);
  assert.equal(q.matchesCriteria(w, { ...base, provinceCode: '01' }), false);
  assert.equal(q.matchesCriteria({ ...w, volumeM3: null }, { ...base, volumePreset: 'xs' }), false);
});

test('active filter count and reset', () => {
  const active = { ...base, provinceCode: '79', areaPreset: 'l', sort: 'newest' };
  assert.equal(q.countActiveFilters(active), 2);
  assert.deepEqual(q.clearFilters(active), { ...base, sort: 'newest' });
});

test('deposit is price times effective deposit months', () => {
  assert.equal(
    q.warehouseDeposit({ monthlyPrice: 6_500_000, effectiveDepositMonths: 2 }),
    13_000_000,
  );
});

test('booking items use the hidden unit id', () => {
  const items = q.buildBookingItems([{ unitId: 'u1' }, { unitId: 'u2' }], '2026-11-01', 6);
  assert.deepEqual(items, [
    { storageUnitId: 'u1', requestedStartAt: '2026-11-01T12:00:00.000Z', rentalMonths: 6 },
    { storageUnitId: 'u2', requestedStartAt: '2026-11-01T12:00:00.000Z', rentalMonths: 6 },
  ]);
});
