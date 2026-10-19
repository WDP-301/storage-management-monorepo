import { DEMO_AMENITIES, DEMO_UNIT_AMENITIES } from './demo-amenities-data';
import { DEMO_WAREHOUSES } from './demo-seed-data';
import { DEMO_SHELF_WAREHOUSE } from './demo-shelf-warehouse-data';

describe('demo amenities data', () => {
  const warehouseCodes = new Set([
    ...DEMO_WAREHOUSES.map((w) => w.code),
    DEMO_SHELF_WAREHOUSE.code,
  ]);
  const catalogCodes = DEMO_AMENITIES.map((amenity) => amenity.code);

  it('has unique, well-formed catalog codes', () => {
    expect(new Set(catalogCodes).size).toBe(catalogCodes.length);
    for (const code of catalogCodes) expect(code).toMatch(/^[A-Z][A-Z0-9_]{1,49}$/);
  });

  it('equips only warehouses that are seeded', () => {
    for (const code of Object.keys(DEMO_UNIT_AMENITIES)) expect(warehouseCodes).toContain(code);
  });

  it('uses catalog amenities once per warehouse with a quantity of 1 to 99', () => {
    for (const items of Object.values(DEMO_UNIT_AMENITIES)) {
      const used = items.map((item) => item.amenityCode);
      expect(new Set(used).size).toBe(used.length);
      for (const item of items) {
        expect(catalogCodes).toContain(item.amenityCode);
        expect(item.quantity).toBeGreaterThanOrEqual(1);
        expect(item.quantity).toBeLessThanOrEqual(99);
      }
    }
  });
});
