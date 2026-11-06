import {
  assertPassUnused,
  lockPass,
  markPassUsedAtCounter,
  type PassRow,
} from './pass-consume.util';

const pass = (over: Partial<PassRow> = {}): PassRow => ({
  id: 'p-1',
  customerId: 'u-1',
  usedAt: null,
  verifiedBy: null,
  eventType: 'COUNTER_SCAN' as never,
  warehouseId: null,
  expired: false,
  live: false,
  ...over,
});

describe('lockPass', () => {
  it('locks the row by token hash with the session length', async () => {
    const query = jest.fn(async () => [pass()]);
    await expect(lockPass({ query } as never, 'hash')).resolves.toMatchObject({ id: 'p-1' });
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('clock_timestamp()');
    expect(params).toEqual(['hash', 30]);
  });

  it('throws NOT_FOUND for an unknown token', async () => {
    const em = { query: jest.fn(async () => []) };
    await expect(lockPass(em as never, 'hash')).rejects.toMatchObject({
      status: 409,
      response: { code: 'ACCESS_PASS_INVALID', details: { reason: 'NOT_FOUND' } },
    });
  });
});

describe('assertPassUnused', () => {
  it('accepts a fresh pass', () => {
    expect(() => assertPassUnused(pass(), 'staff-1')).not.toThrow();
  });

  it('reports USED with who scanned it', () => {
    const usedAt = new Date();
    expect(() => assertPassUnused(pass({ usedAt, verifiedBy: 'staff-1' }), 'staff-1')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          details: { reason: 'USED', usedAt, verifiedByMe: true },
        }),
      }),
    );
    expect(() => assertPassUnused(pass({ usedAt, verifiedBy: 'staff-2' }), 'staff-1')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          details: expect.objectContaining({ verifiedByMe: false }),
        }),
      }),
    );
  });

  it('reports EXPIRED', () => {
    expect(() => assertPassUnused(pass({ expired: true }), 'staff-1')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ details: { reason: 'EXPIRED' } }),
      }),
    );
  });
});

describe('markPassUsedAtCounter', () => {
  it('stamps scanner, place and counter-scan type, returning the DB time', async () => {
    const usedAt = new Date();
    const query = jest.fn(async () => [[{ usedAt }], 1]);
    const result = await markPassUsedAtCounter({ query } as never, 'p-1', 'staff-1', {
      id: 'w-1',
      facilityId: 'f-1',
    });
    expect(result).toBe(usedAt);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('clock_timestamp()');
    expect(params).toEqual(['p-1', 'staff-1', 'w-1', 'f-1', 'COUNTER_SCAN']);
  });
});
