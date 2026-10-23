import type { AuthUser } from '@modules/auth/types/auth-user';
import { UserRole } from '@storage/types';
import { assertCanReadFile, assertFileKeyUnreferenced } from './file-references.util';

describe('assertFileKeyUnreferenced', () => {
  const KEY = 'uploads/1-a.jpg';

  it('looks in finalized inspections, their damages and settlements by jsonb containment', async () => {
    const em = { query: jest.fn(async () => []) };
    await expect(assertFileKeyUnreferenced(em as never, KEY)).resolves.toBeUndefined();
    const [sql, params] = em.query.mock.calls[0] as unknown as [string, string[]];
    expect(sql).toContain('i.finalized_at IS NOT NULL');
    expect(sql).toContain('FROM contract_settlements');
    expect(sql).toContain('FROM contracts c WHERE c.documents @> $1::jsonb');
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

describe('assertCanReadFile', () => {
  const KEY = 'uploads/1-a.jpg';
  const user = (roles: UserRole[]) => ({ id: 'user-1', roles }) as AuthUser;

  it.each([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.FACILITY_MANAGER,
    UserRole.FACILITY_STAFF,
  ])('lets %s open any file without a lookup', async (role) => {
    const em = { query: jest.fn() };
    await expect(assertCanReadFile(em as never, user([role]), KEY)).resolves.toBeUndefined();
    expect(em.query).not.toHaveBeenCalled();
  });

  it('lets a customer open a file attached to something of theirs', async () => {
    const em = { query: jest.fn(async () => [{ '?column?': 1 }]) };
    await expect(
      assertCanReadFile(em as never, user([UserRole.CUSTOMER]), KEY),
    ).resolves.toBeUndefined();
    const [sql, params] = em.query.mock.calls[0] as unknown as [string, string[]];
    expect(sql).toContain('c.customer_id = $1 AND c.documents @> $2::jsonb');
    expect(sql).toContain('t.customer_id = $1');
    expect(params[0]).toBe('user-1');
    expect(params.slice(1).map((p) => JSON.parse(p))).toEqual([
      [{ fileKey: KEY }],
      [{ evidence: [{ fileKey: KEY }] }],
    ]);
  });

  it('lets anyone open what they uploaded themselves without a lookup', async () => {
    const em = { query: jest.fn() };
    const own = 'uploads/user-1-1729000000000-0123456789abcdef-a.jpg';
    await expect(
      assertCanReadFile(em as never, user([UserRole.CUSTOMER]), own),
    ).resolves.toBeUndefined();
    expect(em.query).not.toHaveBeenCalled();
  });

  it('refuses a customer any other file, and an account with no role left', async () => {
    const em = { query: jest.fn(async () => []) };
    for (const roles of [[UserRole.CUSTOMER], []]) {
      await expect(assertCanReadFile(em as never, user(roles), KEY)).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN', details: { fileKey: KEY } },
      });
    }
  });
});
