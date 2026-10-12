import type { LayoutElement, ShelfPlacement } from '@entities/shelf-layout.entity';
import { LayoutElementType } from '@storage/types';
import { type LayoutDocument, validateLayout } from './layout-rules';

const shelves = new Map([
  ['s1', { code: 'KK1-A-01' }],
  ['s2', { code: 'KK1-A-02' }],
  ['s3', { code: 'KK1-A-03' }],
]);

const place = (shelfId: string, row: number, col: number, rowSpan = 1, colSpan = 1) =>
  ({ shelfId, row, col, rowSpan, colSpan }) as ShelfPlacement;
const element = (
  type: LayoutElementType,
  row: number,
  col: number,
  rowSpan = 1,
  colSpan = 1,
  text?: string,
) =>
  ({ type, row, col, rowSpan, colSpan, ...(text === undefined ? {} : { text }) }) as LayoutElement;

const doc = (over: Partial<LayoutDocument> = {}): LayoutDocument => ({
  rows: 4,
  cols: 5,
  elements: [],
  placements: [],
  ...over,
});

const codes = (input: LayoutDocument) =>
  validateLayout(input, shelves).map((p) => `${p.field}:${p.code}`);

describe('validateLayout', () => {
  it('accepts an empty and a full valid plan', () => {
    expect(codes(doc())).toEqual([]);
    expect(
      codes(
        doc({
          placements: [place('s1', 0, 0), place('s2', 0, 1, 2, 2)],
          elements: [
            element(LayoutElementType.DOOR, 3, 0),
            element(LayoutElementType.AISLE, 3, 1, 1, 4),
            element(LayoutElementType.OBSTACLE, 0, 4, 2, 1),
            element(LayoutElementType.LABEL, 2, 0, 1, 1, 'Dãy A'),
          ],
        }),
      ),
    ).toEqual([]);
  });

  describe('grid', () => {
    it.each([
      [0, 5, 'rows'],
      [101, 5, 'rows'],
      [4, 0, 'cols'],
      [4, 101, 'cols'],
      [1.5, 5, 'rows'],
    ])('rejects rows=%s cols=%s', (rows, cols, field) => {
      expect(codes(doc({ rows, cols }))).toEqual([`${field}:OUT_OF_BOUNDS`]);
    });

    it('accepts the 100 x 100 limit', () => {
      expect(codes(doc({ rows: 100, cols: 100 }))).toEqual([]);
    });
  });

  describe('bounds', () => {
    it('allows a rectangle touching the last row and column', () => {
      expect(codes(doc({ placements: [place('s1', 3, 4)] }))).toEqual([]);
    });

    it.each([
      ['one past the last row', place('s1', 4, 0)],
      ['one past the last column', place('s1', 0, 5)],
      ['a span running off the grid', place('s1', 3, 0, 2, 1)],
      ['a negative origin', place('s1', -1, 0)],
      ['a zero span', place('s1', 0, 0, 0, 1)],
      ['a fractional cell', place('s1', 0.5, 0)],
    ])('rejects %s', (_name, placement) => {
      expect(codes(doc({ placements: [placement] }))).toEqual(['placements[0]:OUT_OF_BOUNDS']);
    });

    it('applies to elements too', () => {
      expect(codes(doc({ elements: [element(LayoutElementType.DOOR, 0, 5)] }))).toEqual([
        'elements[0]:OUT_OF_BOUNDS',
      ]);
    });

    it('turns existing items out of bounds when the grid shrinks', () => {
      const placements = [place('s1', 3, 4), place('s2', 0, 0)];
      expect(codes(doc({ rows: 3, cols: 4, placements }))).toEqual(['placements[0]:OUT_OF_BOUNDS']);
    });
  });

  describe('shelves', () => {
    it('rejects a shelf that is not in the warehouse', () => {
      expect(codes(doc({ placements: [place('other', 0, 0)] }))).toEqual([
        'placements[0]:UNKNOWN_SHELF',
      ]);
    });

    it('rejects a shelf placed twice, flagging the second placement', () => {
      expect(codes(doc({ placements: [place('s1', 0, 0), place('s1', 1, 0)] }))).toEqual([
        'placements[1]:DUPLICATE_SHELF',
      ]);
    });
  });

  describe('overlap', () => {
    it('rejects two shelves sharing a cell and names both', () => {
      const problems = validateLayout(
        doc({ placements: [place('s1', 0, 0, 2, 2), place('s2', 1, 1)] }),
        shelves,
      );
      expect(problems).toEqual([
        { field: 'placements[1]', code: 'OVERLAP', message: 'Overlaps placements[0]' },
      ]);
    });

    it.each([[LayoutElementType.AISLE], [LayoutElementType.DOOR], [LayoutElementType.OBSTACLE]])(
      'rejects a shelf on a %s',
      (type) => {
        expect(
          validateLayout(
            doc({ placements: [place('s1', 0, 0)], elements: [element(type, 0, 0)] }),
            shelves,
          ),
        ).toEqual([{ field: 'elements[0]', code: 'OVERLAP', message: 'Overlaps placements[0]' }]);
      },
    );

    it('rejects a door on an obstacle', () => {
      expect(
        codes(
          doc({
            elements: [
              element(LayoutElementType.OBSTACLE, 0, 0, 2, 2),
              element(LayoutElementType.DOOR, 1, 1),
            ],
          }),
        ),
      ).toEqual(['elements[1]:OVERLAP']);
    });

    it('allows touching rectangles', () => {
      expect(codes(doc({ placements: [place('s1', 0, 0), place('s2', 0, 1)] }))).toEqual([]);
    });

    it('lets a label sit over a shelf and over other elements', () => {
      expect(
        codes(
          doc({
            placements: [place('s1', 0, 0)],
            elements: [
              element(LayoutElementType.AISLE, 1, 0, 1, 5),
              element(LayoutElementType.LABEL, 0, 0, 2, 2, 'Trên kệ'),
            ],
          }),
        ),
      ).toEqual([]);
    });

    it('does not count an out-of-bounds item as overlapping', () => {
      expect(codes(doc({ placements: [place('s1', 0, 0), place('s2', 0, 5)] }))).toEqual([
        'placements[1]:OUT_OF_BOUNDS',
      ]);
    });
  });

  describe('label text', () => {
    it.each([[undefined], ['   '], ['']])('requires text for a label (%p)', (text) => {
      expect(
        codes(doc({ elements: [element(LayoutElementType.LABEL, 0, 0, 1, 1, text)] })),
      ).toEqual(['elements[0]:TEXT_REQUIRED']);
    });

    it('allows 60 characters and rejects 61, measured after trimming', () => {
      const at = (text: string) =>
        codes(doc({ elements: [element(LayoutElementType.LABEL, 0, 0, 1, 1, text)] }));
      expect(at(` ${'a'.repeat(60)} `)).toEqual([]);
      expect(at('a'.repeat(61))).toEqual(['elements[0]:TEXT_TOO_LONG']);
    });

    it('keeps text optional but bounded on other types', () => {
      expect(codes(doc({ elements: [element(LayoutElementType.DOOR, 0, 0)] }))).toEqual([]);
      expect(
        codes(doc({ elements: [element(LayoutElementType.DOOR, 0, 0, 1, 1, 'a'.repeat(61))] })),
      ).toEqual(['elements[0]:TEXT_TOO_LONG']);
    });
  });

  describe('limits and ordering', () => {
    it('refuses more than 500 elements or 1000 placements without scanning them', () => {
      const elements = Array.from({ length: 501 }, () => element(LayoutElementType.DOOR, 0, 0));
      const placements = Array.from({ length: 1001 }, () => place('s1', 0, 0));
      expect(codes(doc({ elements, placements }))).toEqual([
        'elements:TOO_MANY_ITEMS',
        'placements:TOO_MANY_ITEMS',
      ]);
    });

    it('accepts exactly 500 elements', () => {
      const elements = Array.from({ length: 500 }, () =>
        element(LayoutElementType.LABEL, 0, 0, 1, 1, 'x'),
      );
      expect(codes(doc({ elements }))).toEqual([]);
    });

    it('lists placements, then elements, then overlaps, in index order', () => {
      expect(
        codes(
          doc({
            placements: [place('s1', 0, 0), place('nope', 9, 9), place('s2', 0, 0)],
            elements: [
              element(LayoutElementType.LABEL, 0, 0),
              element(LayoutElementType.DOOR, 0, 0),
            ],
          }),
        ),
      ).toEqual([
        'placements[1]:OUT_OF_BOUNDS',
        'placements[1]:UNKNOWN_SHELF',
        'elements[0]:TEXT_REQUIRED',
        'placements[2]:OVERLAP',
        'elements[1]:OVERLAP',
      ]);
    });
  });
});
