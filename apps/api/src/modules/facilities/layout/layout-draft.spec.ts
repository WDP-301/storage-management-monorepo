import { LayoutElementType } from '@storage/types';
import { draftLayout, parseShelfCode } from './layout-draft';
import { validateLayout } from './layout-rules';

const shelf = (code: string) => ({ id: `id-${code}`, code });
const asShelves = (list: { id: string; code: string }[]) =>
  new Map(list.map((s) => [s.id, { code: s.code }]));

/** Which shelf code sits at each placement, as "row:col code". */
function layout(list: { id: string; code: string }[]) {
  const draft = draftLayout('KK1', list);
  if (!draft) throw new Error('expected a draft');
  const code = new Map(list.map((s) => [s.id, s.code]));
  return {
    draft,
    shelves: draft.placements.map((p) => `${p.row}:${p.col} ${code.get(p.shelfId)}`),
    labels: draft.elements.filter((e) => e.type === LayoutElementType.LABEL),
    aisles: draft.elements.filter((e) => e.type === LayoutElementType.AISLE),
  };
}

describe('parseShelfCode', () => {
  it('splits parent, prefix and number', () => {
    expect(parseShelfCode('KK1', 'KK1-A-03')).toEqual({ prefix: 'A', number: 3 });
    expect(parseShelfCode('KK1', 'KK1-AB12-100')).toEqual({ prefix: 'AB12', number: 100 });
  });

  it.each(['KK2-A-03', 'KK1-A', 'KK1-A-x', 'KK1-A--3', 'KK1-A-03-1', 'KK1-ABCDEFGHIJK-1', 'A-03'])(
    'rejects %s',
    (code) => {
      expect(parseShelfCode('KK1', code)).toBeNull();
    },
  );
});

describe('draftLayout', () => {
  it('returns a 1x1 empty grid for no shelves', () => {
    expect(draftLayout('KK1', [])).toEqual({ rows: 1, cols: 1, elements: [], placements: [] });
  });

  it('puts one prefix per row with a label column and an aisle between rows', () => {
    const list = ['KK1-A-01', 'KK1-A-02', 'KK1-B-01', 'KK1-C-01', 'KK1-C-02', 'KK1-C-03'].map(
      shelf,
    );
    const { draft, shelves, labels, aisles } = layout(list);

    expect(draft.rows).toBe(5);
    expect(draft.cols).toBe(4);
    expect(shelves).toEqual([
      '0:1 KK1-A-01',
      '0:2 KK1-A-02',
      '2:1 KK1-B-01',
      '4:1 KK1-C-01',
      '4:2 KK1-C-02',
      '4:3 KK1-C-03',
    ]);
    expect(labels.map((l) => [l.row, l.col, l.text])).toEqual([
      [0, 0, 'Dãy A'],
      [2, 0, 'Dãy B'],
      [4, 0, 'Dãy C'],
    ]);
    expect(aisles.map((a) => [a.row, a.col, a.rowSpan, a.colSpan])).toEqual([
      [1, 0, 1, 4],
      [3, 0, 1, 4],
    ]);
    expect(draft.elements.some((e) => e.type === LayoutElementType.DOOR)).toBe(false);
  });

  it('orders numbers numerically and prefixes naturally', () => {
    const list = ['KK1-AA-1', 'KK1-B-1', 'KK1-A-10', 'KK1-A-2', 'KK1-A-1'].map(shelf);
    const { shelves, labels } = layout(list);
    expect(shelves).toEqual([
      '0:1 KK1-A-1',
      '0:2 KK1-A-2',
      '0:3 KK1-A-10',
      '2:1 KK1-B-1',
      '4:1 KK1-AA-1',
    ]);
    expect(labels.map((l) => l.text)).toEqual(['Dãy A', 'Dãy B', 'Dãy AA']);
  });

  it('puts codes that do not follow the pattern last in a "Khác" row ordered by code', () => {
    const list = ['KK1-Z-9', 'legacy-2', 'KK1-A-1', 'legacy-1'].map(shelf);
    const { shelves, labels } = layout(list);
    expect(shelves).toEqual(['0:1 KK1-A-1', '2:1 KK1-Z-9', '4:1 legacy-1', '4:2 legacy-2']);
    expect(labels.map((l) => l.text)).toEqual(['Dãy A', 'Dãy Z', 'Khác']);
  });

  it('wraps a row past 99 shelves, labelling only the first line', () => {
    const list = Array.from({ length: 100 }, (_, i) => shelf(`KK1-A-${i + 1}`));
    const { draft, labels, aisles } = layout(list);
    expect(draft.rows).toBe(3);
    expect(draft.cols).toBe(100);
    expect(draft.placements.filter((p) => p.row === 2)).toHaveLength(1);
    expect(labels).toHaveLength(1);
    expect(aisles).toHaveLength(1);
  });

  it('keeps at least two columns', () => {
    expect(draftLayout('KK1', [shelf('KK1-A-1')])?.cols).toBe(2);
  });

  it('returns null when the rows would exceed the grid', () => {
    const list = Array.from({ length: 51 }, (_, i) => shelf(`KK1-P${i}-1`));
    expect(draftLayout('KK1', list)).toBeNull();
  });

  it('returns null when there are more shelves than a layout may place', () => {
    const list = Array.from({ length: 1001 }, (_, i) => shelf(`KK1-P${i % 20}-${i}`));
    expect(draftLayout('KK1', list)).toBeNull();
  });

  it('fits 50 rows exactly (99 grid rows)', () => {
    const list = Array.from({ length: 50 }, (_, i) => shelf(`KK1-P${i}-1`));
    expect(draftLayout('KK1', list)?.rows).toBe(99);
  });

  it.each([
    ['mixed codes', ['KK1-A-1', 'KK1-A-2', 'KK1-B-7', 'odd', 'KK1-AA-1']],
    ['one wrapped row', Array.from({ length: 150 }, (_, i) => `KK1-A-${i + 1}`)],
    ['a single shelf', ['KK1-A-1']],
  ])('produces a draft that passes validation: %s', (_name, codes) => {
    const list = codes.map(shelf);
    const draft = draftLayout('KK1', list);
    expect(draft).not.toBeNull();
    if (draft) expect(validateLayout(draft, asShelves(list))).toEqual([]);
  });
});
