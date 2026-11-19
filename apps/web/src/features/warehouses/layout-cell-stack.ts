import { LayoutElementType } from '@storage/types';
import type { LayoutElement, LayoutRect, ShelfPlacement } from '../../types/warehouse';

/** One item on the floor plan: a placed shelf, or an element by its index in the element list. */
export type LayoutItemRef = { kind: 'shelf'; shelfId: string } | { kind: 'element'; index: number };

export const coversCell = (rect: LayoutRect, r: number, c: number) =>
  r >= rect.row && r < rect.row + rect.rowSpan && c >= rect.col && c < rect.col + rect.colSpan;

/**
 * Everything on a cell, in click order: the shelf, then floor items (door, aisle, obstacle), then
 * labels. A label is an overlay that may share its cells with any of these, so a click walks this
 * list to reach it.
 */
export function itemsAtCell(
  placements: ShelfPlacement[],
  elements: LayoutElement[],
  r: number,
  c: number,
): LayoutItemRef[] {
  const shelves = placements
    .filter((p) => coversCell(p, r, c))
    .map((p): LayoutItemRef => ({ kind: 'shelf', shelfId: p.shelfId }));
  const floor: LayoutItemRef[] = [];
  const labels: LayoutItemRef[] = [];
  elements.forEach((el, index) => {
    if (!coversCell(el, r, c)) return;
    (el.type === LayoutElementType.LABEL ? labels : floor).push({ kind: 'element', index });
  });
  return [...shelves, ...floor, ...labels];
}

const isSameItem = (a: LayoutItemRef, b: LayoutItemRef) =>
  a.kind === 'shelf'
    ? b.kind === 'shelf' && a.shelfId === b.shelfId
    : b.kind === 'element' && a.index === b.index;

/**
 * The selection after a click on a cell: its first item, or — when one of its items is already
 * selected — the next one, wrapping around, so repeated clicks reach every stacked item.
 */
export function nextSelection(
  stack: LayoutItemRef[],
  selected: LayoutItemRef | null,
): LayoutItemRef | null {
  if (stack.length === 0) return null;
  const current = selected ? stack.findIndex((item) => isSameItem(item, selected)) : -1;
  return stack[(current + 1) % stack.length];
}
