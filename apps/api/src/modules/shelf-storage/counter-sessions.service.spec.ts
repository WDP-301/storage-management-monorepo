import { buildPayload } from '@modules/access/check-in-eligibility';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { UserRole } from '@storage/types';
import { buildCounterPanel } from './counter-panel.query';
import { CounterSessionsService } from './counter-sessions.service';

jest.mock('./counter-panel.query', () => ({
  buildCounterPanel: jest.fn(async (_em: unknown, session: { id: string }) => ({
    sessionId: session.id,
  })),
}));

const payload = buildPayload('B'.repeat(43));
const staff = { id: 'staff-1', roles: [UserRole.FACILITY_STAFF] } as AuthUser;
const usedAt = new Date('2026-11-07T05:00:00Z');

describe('CounterSessionsService', () => {
  let pass: Record<string, unknown> | null;
  let liveSession: Record<string, unknown> | null;
  let contracts: unknown[];
  let assignments: unknown[];
  let warehouse: Record<string, unknown> | null;
  let em: { query: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let service: CounterSessionsService;

  const passRow = (over: Record<string, unknown> = {}) => ({
    id: 'p-1',
    customerId: 'cust-1',
    usedAt: null,
    verifiedBy: null,
    eventType: 'COUNTER_SCAN',
    warehouseId: null,
    expired: false,
    live: false,
    ...over,
  });
  const update = () =>
    em.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE')) as [string, unknown[]];

  beforeEach(() => {
    jest.mocked(buildCounterPanel).mockClear();
    pass = passRow();
    liveSession = {
      id: 'p-1',
      customerId: 'cust-1',
      warehouseId: 'w-1',
      facilityId: 'f-1',
      startedAt: usedAt,
      expiresAt: new Date(usedAt.getTime() + 1_800_000),
      live: true,
    };
    contracts = [{ id: 'c-1' }];
    assignments = [
      {
        userId: 'staff-1',
        role: UserRole.FACILITY_STAFF,
        facilityId: 'f-1',
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: null,
      },
    ];
    warehouse = { id: 'w-1', facilityId: 'f-1', kind: 'SHELF_WAREHOUSE' };
    em = {
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('UPDATE')) return [[{ usedAt }], 1];
        if (sql.includes('"qr_token_hash" = $1')) return pass ? [pass] : [];
        if (sql.includes('"verified_by" = $2')) return liveSession ? [liveSession] : [];
        if (sql.includes('FROM "contracts" c')) return contracts;
        return [];
      }),
      find: jest.fn(async () => assignments),
      findOne: jest.fn(async () => warehouse),
    };
    service = new CounterSessionsService({
      transaction: jest.fn((cb) => cb(em)),
      manager: em,
    } as never);
  });

  const passLookups = () =>
    em.query.mock.calls.filter(([sql]) => sql.includes('"qr_token_hash" = $1'));

  it('rejects a malformed payload before touching the database', async () => {
    await expect(service.open(staff, 'nope', 'w-1')).rejects.toMatchObject({
      response: { code: 'ACCESS_PASS_INVALID', details: { reason: 'MALFORMED' } },
    });
    expect(em.query).not.toHaveBeenCalled();
  });

  it('404s an unknown warehouse', async () => {
    warehouse = null;
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({ status: 404 });
  });

  it('403s staff of another facility without looking the pass up', async () => {
    assignments = [];
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({ status: 403 });
    expect(passLookups()).toHaveLength(0);
  });

  it('reports an unknown pass', async () => {
    pass = null;
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { details: { reason: 'NOT_FOUND' } },
    });
  });

  it('refuses a pass another staff member used, saying it was not me', async () => {
    pass = passRow({ usedAt, verifiedBy: 'staff-2', warehouseId: 'w-1', live: true });
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { details: { reason: 'USED', verifiedByMe: false } },
    });
    expect(update()).toBeUndefined();
  });

  it('reopens my live session at this warehouse without consuming anything', async () => {
    pass = passRow({ usedAt, verifiedBy: 'staff-1', warehouseId: 'w-1', live: true });
    await expect(service.open(staff, payload, 'w-1')).resolves.toEqual({ sessionId: 'p-1' });
    expect(update()).toBeUndefined();
  });

  it('refuses my own pass once its session is over', async () => {
    pass = passRow({ usedAt, verifiedBy: 'staff-1', warehouseId: 'w-1', live: false });
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { details: { reason: 'USED', verifiedByMe: true } },
    });
  });

  it('refuses my live session of another warehouse', async () => {
    pass = passRow({ usedAt, verifiedBy: 'staff-1', warehouseId: 'w-9', live: true });
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { details: { reason: 'USED' } },
    });
  });

  it('refuses an expired pass', async () => {
    pass = passRow({ expired: true });
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { details: { reason: 'EXPIRED' } },
    });
    expect(update()).toBeUndefined();
  });

  it('refuses a customer without a shelf contract here and leaves the pass unused', async () => {
    contracts = [];
    await expect(service.open(staff, payload, 'w-1')).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'NO_SHELF_CONTRACT' } },
    });
    expect(update()).toBeUndefined();
  });

  it('consumes the pass at the counter and builds the panel for a 30-minute session', async () => {
    await expect(service.open(staff, payload, 'w-1')).resolves.toEqual({ sessionId: 'p-1' });
    expect(update()[1]).toEqual(['p-1', 'staff-1', 'w-1', 'f-1', 'COUNTER_SCAN']);
    expect(buildCounterPanel).toHaveBeenCalledWith(
      em,
      expect.objectContaining({
        id: 'p-1',
        customerId: 'cust-1',
        startedAt: usedAt,
        expiresAt: new Date(usedAt.getTime() + 30 * 60_000),
      }),
    );
  });

  it('GET returns the panel of my live session', async () => {
    await expect(service.get(staff, 'p-1')).resolves.toEqual({ sessionId: 'p-1' });
  });

  it('GET refuses an expired session', async () => {
    liveSession = { ...liveSession, live: false };
    await expect(service.get(staff, 'p-1')).rejects.toMatchObject({
      response: { code: 'COUNTER_SESSION_INVALID', details: { reason: 'EXPIRED' } },
    });
  });
});
