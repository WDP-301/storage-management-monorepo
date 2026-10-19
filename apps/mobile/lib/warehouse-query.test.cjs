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

test('matchesNearbyCriteria mirrors the size and price bounds inclusively', () => {
  const w = {
    areaM2: 10,
    volumeM3: 30,
    monthlyPrice: 3_000_000,
    provinceCode: '79',
    wardCode: 'a',
  };
  assert.equal(q.matchesNearbyCriteria(w, { ...base, areaPreset: 'xs', pricePreset: 'xs' }), true);
  assert.equal(q.matchesNearbyCriteria(w, { ...base, areaPreset: 'm' }), false);
  // The search center decides the area, so a province pick must not hide nearby warehouses.
  assert.equal(q.matchesNearbyCriteria(w, { ...base, provinceCode: '01', wardCode: 'b' }), true);
  assert.equal(
    q.matchesNearbyCriteria({ ...w, volumeM3: null }, { ...base, volumePreset: 'xs' }),
    false,
  );
});

test('nearby shelf warehouses use available shelf summary rather than the zero-priced container', () => {
  const parent = {
    kind: 'SHELF_WAREHOUSE',
    areaM2: 100,
    volumeM3: 300,
    monthlyPrice: 0,
    shelfSummary: {
      available: 2,
      minMonthlyPrice: 500_000,
      minAreaM2: 1,
      maxAreaM2: 3,
      minVolumeM3: 2,
      maxVolumeM3: 6,
    },
  };
  assert.equal(
    q.matchesNearbyCriteria(parent, { ...base, areaPreset: 'xs', pricePreset: 'xs' }),
    true,
  );
  assert.equal(q.matchesNearbyCriteria(parent, { ...base, areaPreset: 'm' }), false);
  assert.equal(
    q.matchesNearbyCriteria(
      { ...parent, shelfSummary: { ...parent.shelfSummary, available: 0 } },
      base,
    ),
    false,
  );
});

test('amenity ids are sorted and encoded, and omitted when none are chosen', () => {
  assert.equal('amenityIds' in params(q.buildWarehouseQuery(base)), false);
  const query = q.buildWarehouseQuery({ ...base, amenityIds: ['b-2', 'a-1'] });
  assert.match(query, /amenityIds=a-1%2Cb-2&sort=/);
  assert.equal(params(query).amenityIds, 'a-1,b-2');
});

test('nearby requires every selected amenity, for warehouses and shelf warehouses', () => {
  const owned = (...ids) => ids.map((amenityId) => ({ amenityId }));
  const w = {
    kind: 'SELF_STORAGE',
    areaM2: 10,
    volumeM3: 30,
    monthlyPrice: 1,
    amenities: owned('a', 'b', 'c'),
  };
  const crit = { ...base, amenityIds: ['a', 'b'] };
  assert.equal(q.matchesNearbyCriteria(w, crit), true);
  assert.equal(q.matchesNearbyCriteria({ ...w, amenities: owned('a') }, crit), false);
  assert.equal(q.matchesNearbyCriteria({ ...w, amenities: undefined }, crit), false);
  assert.equal(q.matchesNearbyCriteria({ ...w, amenities: undefined }, base), true);
  const shelfWarehouse = {
    kind: 'SHELF_WAREHOUSE',
    shelfSummary: {
      available: 1,
      minMonthlyPrice: 1,
      minAreaM2: 1,
      maxAreaM2: 1,
      minVolumeM3: 1,
      maxVolumeM3: 1,
    },
    amenities: owned('a'),
  };
  assert.equal(q.matchesNearbyCriteria(shelfWarehouse, crit), false);
  assert.equal(
    q.matchesNearbyCriteria({ ...shelfWarehouse, amenities: owned('a', 'b') }, crit),
    true,
  );
});

test('toggleAmenityId adds, removes and caps the selection', () => {
  assert.deepEqual(q.toggleAmenityId(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(q.toggleAmenityId(['a', 'b'], 'a'), ['b']);
  const full = Array.from({ length: q.MAX_AMENITY_FILTER }, (_, i) => `id${i}`);
  assert.deepEqual(q.toggleAmenityId(full, 'extra'), full);
  assert.equal(q.toggleAmenityId(full, 'id0').length, q.MAX_AMENITY_FILTER - 1);
});

test('amenity selection counts as one active filter and is cleared by reset', () => {
  const active = { ...base, amenityIds: ['a', 'b'], sort: 'newest' };
  assert.equal(q.countActiveFilters(active), 1);
  assert.deepEqual(q.clearFilters(active), { ...base, sort: 'newest' });
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
  const items = q.buildBookingItems([{ id: 'u1' }, { id: 'u2' }], '2026-11-01', 6);
  assert.deepEqual(items, [
    { storageUnitId: 'u1', requestedStartAt: '2026-11-01T12:00:00.000Z', rentalMonths: 6 },
    { storageUnitId: 'u2', requestedStartAt: '2026-11-01T12:00:00.000Z', rentalMonths: 6 },
  ]);
});
