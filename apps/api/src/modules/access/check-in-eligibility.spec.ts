import { assertCanIssuePass, buildPayload, parsePayload } from './check-in-eligibility';

const NOW = new Date('2026-11-07T05:00:00Z');
const row = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  contractNo: 'HD-1',
  status: 'ACTIVE',
  customerId: 'u-1',
  effectiveAt: new Date('2026-01-01T00:00:00Z'),
  shelfId: 's-1',
  shelfCode: 'K-1',
  shelfName: 'Kệ 1',
  warehouseId: 'w-1',
  warehouseCode: 'W-1',
  warehouseName: 'Kho 1',
  facilityId: 'f-1',
  facilityCode: 'F-1',
  facilityName: 'CN 1',
  returnOpen: false,
  ...over,
});

const emWith = (contracts: unknown[], overdue: { invoiceNo: string }[] = []) => {
  const query = jest.fn(async (sql: string, _params?: unknown[]) =>
    sql.includes('FROM "invoices"') ? overdue : contracts,
  );
  return { em: { query } as never, query };
};

describe('assertCanIssuePass', () => {
  it('passes with a started contract and no debt', async () => {
    const { em } = emWith([row()]);
    await expect(assertCanIssuePass(em, 'u-1', NOW)).resolves.toBeUndefined();
  });

  it('asks only for ACTIVE contracts of the customer', async () => {
    const { em, query } = emWith([row()]);
    await assertCanIssuePass(em, 'u-1', NOW);
    expect(query.mock.calls[0][1]).toEqual(['u-1', ['ACTIVE']]);
  });

  it('refuses without a shelf contract', async () => {
    const { em } = emWith([]);
    await expect(assertCanIssuePass(em, 'u-1', NOW)).rejects.toMatchObject({
      response: { code: 'CHECK_IN_NOT_ALLOWED', details: { reason: 'NO_SHELF_CONTRACT' } },
    });
  });

  it('refuses until the earliest contract starts and reports it', async () => {
    const soon = new Date('2026-12-01T00:00:00Z');
    const { em } = emWith([
      row({ effectiveAt: new Date('2027-01-01T00:00:00Z') }),
      row({ id: 'c-2', effectiveAt: soon }),
    ]);
    await expect(assertCanIssuePass(em, 'u-1', NOW)).rejects.toMatchObject({
      response: {
        code: 'CHECK_IN_NOT_ALLOWED',
        details: { reason: 'CONTRACT_NOT_STARTED', effectiveAt: soon },
      },
    });
  });

  it('refuses with the overdue invoice numbers', async () => {
    const { em } = emWith([row()], [{ invoiceNo: 'INV-9' }]);
    await expect(assertCanIssuePass(em, 'u-1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { code: 'INVOICE_OVERDUE', details: { invoiceNos: ['INV-9'] } },
    });
  });

  it('skips the debt check when a contract is being returned', async () => {
    const { em, query } = emWith(
      [row(), row({ id: 'c-2', returnOpen: true })],
      [{ invoiceNo: 'INV-9' }],
    );
    await expect(assertCanIssuePass(em, 'u-1', NOW)).resolves.toBeUndefined();
    expect(query.mock.calls.some(([sql]) => sql.includes('FROM "invoices"'))).toBe(false);
  });
});

describe('parsePayload', () => {
  const token = 'A'.repeat(43);

  it('round-trips a built payload', () => {
    expect(parsePayload(buildPayload(token))).toBe(token);
  });

  it('ignores whitespace a scanner adds around the payload', () => {
    expect(parsePayload(` ${buildPayload(token)}\r\n`)).toBe(token);
  });

  it.each([
    '',
    token,
    `SMCI1:${'A'.repeat(42)}`,
    `SMCI1:${'A'.repeat(44)}`,
    `SMCI2:${token}`,
    `SMCI1:${'!'.repeat(43)}`,
  ])('rejects %p', (payload) => {
    expect(parsePayload(payload)).toBeNull();
  });
});
