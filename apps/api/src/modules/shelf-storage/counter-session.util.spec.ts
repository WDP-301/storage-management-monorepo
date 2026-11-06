import { assertLiveSession } from './counter-session.util';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'ses-1',
  customerId: 'cust-1',
  warehouseId: 'w-1',
  facilityId: 'f-1',
  startedAt: new Date('2026-11-07T05:00:00Z'),
  expiresAt: new Date('2026-11-07T05:30:00Z'),
  live: true,
  ...over,
});
const emWith = (rows: unknown[]) => ({ query: jest.fn(async () => rows) }) as never;
const contract = { customerId: 'cust-1', warehouse: { id: 'w-1' } };
const reason = (value: string) =>
  expect.objectContaining({
    status: 409,
    response: expect.objectContaining({
      code: 'COUNTER_SESSION_INVALID',
      details: { reason: value },
    }),
  });

describe('assertLiveSession', () => {
  it('returns the session of its scanner without the liveness flag', async () => {
    const em = emWith([row()]);
    const session = await assertLiveSession(em, { id: 'staff-1' }, 'ses-1', contract);
    expect(session).toEqual(expect.objectContaining({ id: 'ses-1', customerId: 'cust-1' }));
    expect(session).not.toHaveProperty('live');
  });

  it('looks the session up by scanner and counter-scan type', async () => {
    const query = jest.fn(async () => [row()]);
    await assertLiveSession({ query } as never, { id: 'staff-1' }, 'ses-1');
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('"verified_by" = $2');
    expect(params).toEqual(['ses-1', 'staff-1', 30, 'COUNTER_SCAN']);
  });

  it('answers NOT_FOUND for a missing or another staff member session', async () => {
    await expect(assertLiveSession(emWith([]), { id: 'staff-2' }, 'ses-1')).rejects.toEqual(
      reason('NOT_FOUND'),
    );
  });

  it('answers EXPIRED after the session window', async () => {
    await expect(
      assertLiveSession(emWith([row({ live: false })]), { id: 'staff-1' }, 'ses-1'),
    ).rejects.toEqual(reason('EXPIRED'));
  });

  it('refuses a contract of another customer', async () => {
    await expect(
      assertLiveSession(emWith([row()]), { id: 'staff-1' }, 'ses-1', {
        ...contract,
        customerId: 'cust-2',
      }),
    ).rejects.toEqual(reason('WRONG_CUSTOMER'));
  });

  it('refuses a contract in another warehouse', async () => {
    await expect(
      assertLiveSession(emWith([row()]), { id: 'staff-1' }, 'ses-1', {
        ...contract,
        warehouse: { id: 'w-2' },
      }),
    ).rejects.toEqual(reason('WRONG_WAREHOUSE'));
  });
});
