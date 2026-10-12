import type { LayoutElement, LayoutRect, ShelfPlacement } from '@entities/shelf-layout.entity';
import { LayoutElementType } from '@storage/types';

export const MAX_GRID_SIDE = 100;
export const MAX_LAYOUT_TEXT = 60;
export const MAX_LAYOUT_ELEMENTS = 500;
export const MAX_LAYOUT_PLACEMENTS = 1000;

/** Item kinds that occupy floor space; a LABEL is an overlay and may sit on top of anything. */
const BLOCKING_ELEMENTS: ReadonlySet<string> = new Set([
  LayoutElementType.DOOR,
  LayoutElementType.AISLE,
  LayoutElementType.OBSTACLE,
]);

export interface LayoutDocument {
  rows: number;
  cols: number;
  elements: LayoutElement[];
  placements: ShelfPlacement[];
}

/** `field` points into the document, e.g. `placements[3]`; `code` is stable for clients. */
export interface LayoutProblem {
  field: string;
  code: string;
  message: string;
}

const isGridSide = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_GRID_SIDE;

const isWhole = (value: unknown, min: number): boolean =>
  Number.isInteger(value) && (value as number) >= min;

/** Whether the rectangle is made of whole cells and lies inside a rows x cols grid. */
function fitsGrid(rect: LayoutRect, rows: number, cols: number): boolean {
  return (
    isWhole(rect.row, 0) &&
    isWhole(rect.col, 0) &&
    isWhole(rect.rowSpan, 1) &&
    isWhole(rect.colSpan, 1) &&
    rect.row + rect.rowSpan <= rows &&
    rect.col + rect.colSpan <= cols
  );
}

/** Row-major cell indexes covered by an in-bounds rectangle. */
export function rectCells(rect: LayoutRect, cols: number): number[] {
  const cells: number[] = [];
  for (let r = rect.row; r < rect.row + rect.rowSpan; r += 1) {
    for (let c = rect.col; c < rect.col + rect.colSpan; c += 1) cells.push(r * cols + c);
  }
  return cells;
}

function textProblem(element: LayoutElement, field: string): LayoutProblem | null {
  const text = typeof element.text === 'string' ? element.text.trim() : undefined;
  if (element.type === LayoutElementType.LABEL && !text) {
    return { field, code: 'TEXT_REQUIRED', message: 'A label needs text' };
  }
  if (text !== undefined && text.length > MAX_LAYOUT_TEXT) {
    return {
      field,
      code: 'TEXT_TOO_LONG',
      message: `Text is at most ${MAX_LAYOUT_TEXT} characters`,
    };
  }
  return null;
}

interface Blocking {
  field: string;
  rect: LayoutRect;
}

/**
 * Checks a floor plan against the live shelves of its warehouse (`shelves` is keyed by shelf id).
 * Problems come back in a fixed order: grid, limits, placements, elements, then overlaps.
 */
export function validateLayout(
  input: LayoutDocument,
  shelves: ReadonlyMap<string, { code: string }>,
): LayoutProblem[] {
  const { rows, cols, elements, placements } = input;
  const problems: LayoutProblem[] = [];
  const side = (field: string, value: unknown) => {
    if (isGridSide(value)) return;
    problems.push({
      field,
      code: 'OUT_OF_BOUNDS',
      message: `${field} must be a whole number from 1 to ${MAX_GRID_SIDE}`,
    });
  };
  side('rows', rows);
  side('cols', cols);
  if (elements.length > MAX_LAYOUT_ELEMENTS) {
    problems.push({
      field: 'elements',
      code: 'TOO_MANY_ITEMS',
      message: `At most ${MAX_LAYOUT_ELEMENTS} elements`,
    });
  }
  if (placements.length > MAX_LAYOUT_PLACEMENTS) {
    problems.push({
      field: 'placements',
      code: 'TOO_MANY_ITEMS',
      message: `At most ${MAX_LAYOUT_PLACEMENTS} placements`,
    });
  }
  // Without a sane grid or bounded lists there is nothing meaningful (or cheap) left to check.
  if (problems.length > 0) return problems;

  const blocking: Blocking[] = [];
  const seenShelves = new Set<string>();
  const checkRect = (field: string, rect: LayoutRect): boolean => {
    if (fitsGrid(rect, rows, cols)) return true;
    problems.push({
      field,
      code: 'OUT_OF_BOUNDS',
      message: `Must cover whole cells inside the ${rows}x${cols} grid`,
    });
    return false;
  };

  placements.forEach((placement, index) => {
    const field = `placements[${index}]`;
    const inBounds = checkRect(field, placement);
    if (!shelves.has(placement.shelfId)) {
      problems.push({ field, code: 'UNKNOWN_SHELF', message: 'Not a shelf of this warehouse' });
    } else if (seenShelves.has(placement.shelfId)) {
      problems.push({ field, code: 'DUPLICATE_SHELF', message: 'Shelf is placed more than once' });
    }
    seenShelves.add(placement.shelfId);
    if (inBounds) blocking.push({ field, rect: placement });
  });

  elements.forEach((element, index) => {
    const field = `elements[${index}]`;
    const inBounds = checkRect(field, element);
    if (!Object.values(LayoutElementType).includes(element.type)) {
      problems.push({ field, code: 'INVALID_TYPE', message: 'Unknown element type' });
    }
    const text = textProblem(element, field);
    if (text) problems.push(text);
    if (inBounds && BLOCKING_ELEMENTS.has(element.type)) blocking.push({ field, rect: element });
  });

  problems.push(...overlapProblems(blocking, rows, cols));
  return problems;
}

/** One pass over an occupancy grid; each item reports the first earlier item it runs into. */
function overlapProblems(items: Blocking[], rows: number, cols: number): LayoutProblem[] {
  const owner = new Int32Array(rows * cols).fill(-1);
  const problems: LayoutProblem[] = [];
  items.forEach((item, index) => {
    let clash = -1;
    for (const cell of rectCells(item.rect, cols)) {
      if (owner[cell] === -1) owner[cell] = index;
      else if (clash === -1) clash = owner[cell];
    }
    if (clash !== -1) {
      problems.push({
        field: item.field,
        code: 'OVERLAP',
        message: `Overlaps ${items[clash].field}`,
      });
    }
  });
  return problems;
}
