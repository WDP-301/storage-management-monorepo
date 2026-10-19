import { rectCells, validateLayout } from '@modules/facilities/layout/layout-rules';
import {
  DEMO_SHELF_LAYOUT,
  DEMO_SHELF_STATUS,
  DEMO_SHELF_WAREHOUSE,
  DEMO_SHELF_ZONES,
} from './demo-shelf-warehouse-data';

const shelfCodes = DEMO_SHELF_ZONES.flatMap((zone) =>
  zone.rects.map((_, index) => `${zone.prefix}-${String(index + 1).padStart(2, '0')}`),
);
const placements = DEMO_SHELF_ZONES.flatMap((zone) => zone.rects).map((rect, index) => ({
  shelfId: `shelf-${index}`,
  ...rect,
}));

describe('demo shelf warehouse floor plan', () => {
  it('passes the rules an editor save is held to', () => {
    const shelves = new Map(
      placements.map((placement, index) => [
        placement.shelfId,
        { code: `${DEMO_SHELF_WAREHOUSE.code}-${shelfCodes[index]}` },
      ]),
    );
    expect(validateLayout({ ...DEMO_SHELF_LAYOUT, placements }, shelves)).toEqual([]);
  });

  it('leaves no floor cell undrawn', () => {
    const { rows, cols, elements } = DEMO_SHELF_LAYOUT;
    const covered = new Set([...elements, ...placements].flatMap((rect) => rectCells(rect, cols)));
    const empty = Array.from({ length: rows * cols }, (_, cell) => cell)
      .filter((cell) => !covered.has(cell))
      .map((cell) => `${Math.floor(cell / cols)},${cell % cols}`);
    expect(empty).toEqual([]);
  });

  it('only overrides the status of shelves that exist', () => {
    const missing = Object.keys(DEMO_SHELF_STATUS).filter((code) => !shelfCodes.includes(code));
    expect(missing).toEqual([]);
  });
});
