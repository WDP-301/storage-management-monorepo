import { assertFileKeyUnreferenced } from './file-references.util';

describe('assertFileKeyUnreferenced', () => {
  const KEY = 'uploads/1-a.jpg';

  it('looks in finalized inspections, their damages and settlements by jsonb containment', async () => {
    const em = { query: jest.fn(async () => []) };
    await expect(assertFileKeyUnreferenced(em as never, KEY)).resolves.toBeUndefined();
    const [sql, params] = em.query.mock.calls[0] as unknown as [string, string[]];
    expect(sql).toContain('i.finalized_at IS NOT NULL');
    expect(sql).toContain('FROM contract_settlements');
    expect(params.map((p) => JSON.parse(p))).toEqual([
      [{ fileKey: KEY }],
      [{ evidence: [{ fileKey: KEY }] }],
    ]);
  });

  it('refuses a file still used as evidence', async () => {
    const em = { query: jest.fn(async () => [{ '?column?': 1 }]) };
    await expect(assertFileKeyUnreferenced(em as never, KEY)).rejects.toMatchObject({
      status: 409,
      response: { code: 'FILE_IN_USE', details: { fileKey: KEY } },
    });
  });
});
