const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// goong-map-config only imports types, so it compiles with no runtime dependencies to stub.
function loadMapConfig() {
  const filename = path.join(__dirname, 'goong-map-config.ts');
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

const { toLngLat, toLngLatBounds, hasPlottableCoords } = loadMapConfig();

test('toLngLat puts longitude first — the swap that silently drops pins into the sea', () => {
  // A real HCM facility. Swapped, [10.77, 106.70] lands in the Pacific near Kiribati.
  assert.deepEqual(
    toLngLat({ latitude: 10.776889, longitude: 106.700806 }),
    [106.700806, 10.776889],
  );
});

test('coordinates missing from the API are not plottable', () => {
  // `toNumber` turns null/'' into 0, so 0/0 means "no data", not "Gulf of Guinea".
  assert.equal(hasPlottableCoords({ latitude: 0, longitude: 0 }), false);
  assert.equal(hasPlottableCoords({ latitude: Number.NaN, longitude: 106.7 }), false);
  assert.equal(hasPlottableCoords({ latitude: 10.77, longitude: 106.7 }), true);
});

test('out-of-range values are rejected, catching a swap that survived parsing', () => {
  // latitude 106 is impossible; this is what a reversed pair looks like for a far-east longitude.
  assert.equal(hasPlottableCoords({ latitude: 106.7, longitude: 10.77 }), false);
});

test('bounds come back as [west, south, east, north]', () => {
  const bounds = toLngLatBounds([
    { latitude: 10.7, longitude: 106.6 },
    { latitude: 10.9, longitude: 106.8 },
  ]);
  assert.deepEqual(bounds, [106.6, 10.7, 106.8, 10.9]);
});

test('a single facility gets a padded box instead of a zero-size one', () => {
  const [west, south, east, north] = toLngLatBounds([{ latitude: 10.8, longitude: 106.7 }]);
  assert.ok(east - west >= 0.02 - 1e-9, 'longitude span padded');
  assert.ok(north - south >= 0.02 - 1e-9, 'latitude span padded');
});

test('facilities without coordinates are skipped, not treated as 0/0', () => {
  // Otherwise one bad row stretches the box from Vietnam to Africa and every pin becomes a dot.
  const bounds = toLngLatBounds([
    { latitude: 10.7, longitude: 106.6 },
    { latitude: 0, longitude: 0 },
    { latitude: 10.9, longitude: 106.8 },
  ]);
  assert.deepEqual(bounds, [106.6, 10.7, 106.8, 10.9]);
});

test('an empty list yields null so the caller keeps its initial camera', () => {
  assert.equal(toLngLatBounds([]), null);
  assert.equal(toLngLatBounds([{ latitude: 0, longitude: 0 }]), null);
});

test('circlePolygon draws a closed ring radiusKm from the center', () => {
  const { circlePolygon } = loadMapConfig();
  const center = { lat: 10.7869, lng: 106.7372 };
  const ring = circlePolygon(center, 5).geometry.coordinates[0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  const toRad = (deg) => (deg * Math.PI) / 180;
  for (const [lng, lat] of ring) {
    const dLat = toRad(lat - center.lat);
    const dLng = toRad(lng - center.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(center.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    assert.ok(Math.abs(km - 5) < 0.01, `point ${lng},${lat} is ${km} km away`);
  }
});
