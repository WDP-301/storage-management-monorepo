import type { LayoutElement, ShelfPlacement } from '@entities/shelf-layout.entity';
import { LayoutElementType } from '@storage/types';
import { type LayoutDocument, MAX_GRID_SIDE, MAX_LAYOUT_PLACEMENTS } from './layout-rules';

/** Widest shelf row; one more column holds the row label, keeping the grid within the limit. */
const MAX_SHELVES_PER_ROW = MAX_GRID_SIDE - 1;
const OTHER_GROUP_LABEL = 'Khác';

interface DraftShelf {
  id: string;
  code: string;
}

interface ParsedCode {
  prefix: string;
  number: number;
}

/** `<parentCode>-<PREFIX>-<NUMBER>` as the bulk shelf creator writes it; anything else is null. */
export function parseShelfCode(parentCode: string, code: string): ParsedCode | null {
  const head = `${parentCode}-`;
  if (!code.startsWith(head)) return null;
  const match = /^([A-Za-z0-9]{1,10})-(\d+)$/.exec(code.slice(head.length));
  return match ? { prefix: match[1], number: Number(match[2]) } : null;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byCode = (a: DraftShelf, b: DraftShelf) => compare(a.code, b.code);

/** A..Z before AA, 2 before 10: shorter prefixes first, then alphabetical. */
const byPrefix = (a: string, b: string) =>
  a.length - b.length || compare(a.toUpperCase(), b.toUpperCase()) || compare(a, b);

interface Group {
  label: string;
  shelves: DraftShelf[];
}

function groupShelves(parentCode: string, shelves: DraftShelf[]): Group[] {
  const byGroup = new Map<string, { shelf: DraftShelf; number: number }[]>();
  const others: DraftShelf[] = [];
  for (const shelf of shelves) {
    const parsed = parseShelfCode(parentCode, shelf.code);
    if (!parsed) {
      others.push(shelf);
      continue;
    }
    const list = byGroup.get(parsed.prefix) ?? [];
    list.push({ shelf, number: parsed.number });
    byGroup.set(parsed.prefix, list);
  }
  const groups: Group[] = [...byGroup.keys()].sort(byPrefix).map((prefix) => ({
    label: `Dãy ${prefix}`,
    shelves: (byGroup.get(prefix) ?? [])
      .sort((a, b) => a.number - b.number || byCode(a.shelf, b.shelf))
      .map((entry) => entry.shelf),
  }));
  if (others.length > 0) {
    groups.push({ label: OTHER_GROUP_LABEL, shelves: others.sort(byCode) });
  }
  return groups;
}

/**
 * Proposes a floor plan from shelf codes: one row of 1x1 shelves per code prefix, labelled in the
 * first column, with a full-width aisle between rows. Returns null when the shelves need more
 * rows than the grid allows or more placements than a saved layout may hold, since such a draft
 * could never be saved. Never saved — the editor adjusts it first.
 */
export function draftLayout(parentCode: string, shelves: DraftShelf[]): LayoutDocument | null {
  if (shelves.length === 0) return { rows: 1, cols: 1, elements: [], placements: [] };
  if (shelves.length > MAX_LAYOUT_PLACEMENTS) return null;

  const lines: { label: string | null; shelves: DraftShelf[] }[] = [];
  for (const group of groupShelves(parentCode, shelves)) {
    for (let start = 0; start < group.shelves.length; start += MAX_SHELVES_PER_ROW) {
      lines.push({
        label: start === 0 ? group.label : null,
        shelves: group.shelves.slice(start, start + MAX_SHELVES_PER_ROW),
      });
    }
  }

  const rows = lines.length * 2 - 1;
  if (rows > MAX_GRID_SIDE) return null;
  const cols = Math.max(2, 1 + Math.max(...lines.map((line) => line.shelves.length)));

  const elements: LayoutElement[] = [];
  const placements: ShelfPlacement[] = [];
  lines.forEach((line, index) => {
    const row = index * 2;
    if (index > 0) {
      elements.push({
        type: LayoutElementType.AISLE,
        row: row - 1,
        col: 0,
        rowSpan: 1,
        colSpan: cols,
      });
    }
    if (line.label) {
      elements.push({
        type: LayoutElementType.LABEL,
        row,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
        text: line.label,
      });
    }
    line.shelves.forEach((shelf, slot) => {
      placements.push({ shelfId: shelf.id, row, col: 1 + slot, rowSpan: 1, colSpan: 1 });
    });
  });
  return { rows, cols, elements, placements };
}
