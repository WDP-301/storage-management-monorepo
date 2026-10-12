import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { DeleteLayoutQueryDto, SaveLayoutDto } from './layout.dto';

const SHELF_ID = '6f1f0c0e-8a52-4c1b-9d57-0a3a3d1f3b11';
const pipe = createApiValidationPipe();

const valid = () => ({
  rows: 4,
  cols: 5,
  version: 0,
  elements: [{ type: 'DOOR', row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
  placements: [{ shelfId: SHELF_ID, row: 1, col: 1, rowSpan: 1, colSpan: 2 }],
});

const fieldsFailing = async (
  plain: object,
  metatype: new () => object = SaveLayoutDto,
  type: 'body' | 'query' = 'body',
) => {
  try {
    await pipe.transform(plain, { type, metatype });
    return [];
  } catch (err) {
    const body = (
      err as { getResponse(): { details: { fields: { field: string }[] } } }
    ).getResponse();
    return [...new Set(body.details.fields.map((f) => f.field))];
  }
};

describe('SaveLayoutDto', () => {
  it('accepts a valid plan, including an empty one', async () => {
    await expect(fieldsFailing(valid())).resolves.toEqual([]);
    await expect(fieldsFailing({ ...valid(), elements: [], placements: [] })).resolves.toEqual([]);
  });

  it.each([
    ['fractional rows', { rows: 2.5 }, 'rows'],
    ['zero cols', { cols: 0 }, 'cols'],
    ['101 rows', { rows: 101 }, 'rows'],
    ['negative version', { version: -1 }, 'version'],
    ['fractional version', { version: 1.5 }, 'version'],
    ['missing version', { version: undefined }, 'version'],
  ])('rejects %s', async (_name, patch, field) => {
    await expect(fieldsFailing({ ...valid(), ...patch })).resolves.toEqual([field]);
  });

  it('rejects an unknown element type, a text over the limit and extra fields', async () => {
    const base = { row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    await expect(
      fieldsFailing({ ...valid(), elements: [{ ...base, type: 'WALL' }] }),
    ).resolves.toEqual(['elements.0.type']);
    await expect(
      fieldsFailing({ ...valid(), elements: [{ ...base, type: 'LABEL', text: 'x'.repeat(121) }] }),
    ).resolves.toEqual(['elements.0.text']);
    await expect(
      fieldsFailing({ ...valid(), elements: [{ ...base, type: 'DOOR', color: 'red' }] }),
    ).resolves.toEqual(['elements.0.color']);
    await expect(fieldsFailing({ ...valid(), extra: 1 })).resolves.toEqual(['extra']);
  });

  it('rejects a bad shelf id and non-integer or non-positive cells', async () => {
    await expect(
      fieldsFailing({
        ...valid(),
        placements: [{ shelfId: 'nope', row: 0.5, col: -1, rowSpan: 0, colSpan: 1 }],
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        'placements.0.shelfId',
        'placements.0.row',
        'placements.0.col',
        'placements.0.rowSpan',
      ]),
    );
  });

  it('caps elements at 500 and placements at 1000', async () => {
    const element = { type: 'DOOR', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    const placement = { shelfId: SHELF_ID, row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    await expect(
      fieldsFailing({
        ...valid(),
        elements: Array(501).fill(element),
        placements: Array(1001).fill(placement),
      }),
    ).resolves.toEqual(['elements', 'placements']);
  });
});

describe('DeleteLayoutQueryDto', () => {
  it('reads the version from the query string', async () => {
    const out = await pipe.transform(
      { version: '3' },
      { type: 'query', metatype: DeleteLayoutQueryDto },
    );
    expect(out.version).toBe(3);
  });

  it.each([[{}], [{ version: 'x' }], [{ version: '-1' }]])('rejects %p', async (query) => {
    await expect(fieldsFailing(query, DeleteLayoutQueryDto, 'query')).resolves.toEqual(['version']);
  });
});
