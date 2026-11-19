import { LayoutElementType } from '@storage/types';
import { describe, expect, it } from 'vitest';
import type { LayoutElement, ShelfPlacement } from '../../types/warehouse';
import { itemsAtCell, nextSelection } from './layout-cell-stack';

const shelf: ShelfPlacement = { shelfId: 'sh-1', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
const elements: LayoutElement[] = [
  // Drawn before the door, but still comes after it: labels always sit on top.
  { type: LayoutElementType.LABEL, row: 1, col: 0, rowSpan: 1, colSpan: 2, text: 'Thoát hiểm' },
  { type: LayoutElementType.DOOR, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
  { type: LayoutElementType.LABEL, row: 0, col: 0, rowSpan: 2, colSpan: 1, text: 'Dãy A' },
];

describe('itemsAtCell', () => {
  it('lists the shelf, then floor items, then labels', () => {
    expect(itemsAtCell([shelf], elements, 0, 0)).toEqual([
      { kind: 'shelf', shelfId: 'sh-1' },
      { kind: 'element', index: 2 },
    ]);
    expect(itemsAtCell([shelf], elements, 1, 0)).toEqual([
      { kind: 'element', index: 1 },
      { kind: 'element', index: 0 },
      { kind: 'element', index: 2 },
    ]);
  });

  it('finds a label on its own and nothing on an empty cell', () => {
    expect(itemsAtCell([shelf], elements, 1, 1)).toEqual([{ kind: 'element', index: 0 }]);
    expect(itemsAtCell([shelf], elements, 0, 1)).toEqual([]);
  });
});

describe('nextSelection', () => {
  const stack = itemsAtCell([shelf], elements, 1, 0);

  it('selects the first item when nothing on the cell is selected', () => {
    expect(nextSelection(stack, null)).toEqual(stack[0]);
    expect(nextSelection(stack, { kind: 'shelf', shelfId: 'sh-1' })).toEqual(stack[0]);
  });

  it('walks to the next stacked item on each click and wraps around', () => {
    expect(nextSelection(stack, stack[0])).toEqual(stack[1]);
    expect(nextSelection(stack, stack[1])).toEqual(stack[2]);
    expect(nextSelection(stack, stack[2])).toEqual(stack[0]);
  });

  it('keeps a lone item selected and clears on an empty cell', () => {
    const lone = [{ kind: 'element', index: 0 } as const];
    expect(nextSelection(lone, lone[0])).toEqual(lone[0]);
    expect(nextSelection([], stack[0])).toBeNull();
  });
});
