import { ContractStatus } from '@storage/types';
import { assertContractDeletable } from './contract-delete-guard.util';

describe('assertContractDeletable', () => {
  const em = (row: Record<string, unknown>) => ({
    query: jest.fn(async () => [
      { settlement_status: null, open_invoices: false, held_deposit: false, ...row },
    ]),
  });
  const check = (status: ContractStatus, row: Record<string, unknown> = {}) =>
    assertContractDeletable(em(row) as never, { id: 'contract-1', status });

  it('lets a settled contract or a cancelled one without money go', async () => {
    await expect(
      check(ContractStatus.ENDED, { settlement_status: 'COMPLETED' }),
    ).resolves.toBeUndefined();
    await expect(check(ContractStatus.CANCELLED)).resolves.toBeUndefined();
  });

  it.each([
    [ContractStatus.ENDED, {}, 'SETTLEMENT_OPEN'],
    [ContractStatus.ENDED, { settlement_status: 'AWAITING_REFUND' }, 'SETTLEMENT_OPEN'],
    [
      ContractStatus.ENDED,
      { settlement_status: 'COMPLETED', open_invoices: true },
      'INVOICES_OPEN',
    ],
    [ContractStatus.CANCELLED, { open_invoices: true }, 'INVOICES_OPEN'],
    [ContractStatus.CANCELLED, { held_deposit: true }, 'DEPOSIT_HELD'],
  ])('keeps a %s contract with %o (%s)', async (status, row, reason) => {
    await expect(check(status, row)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONFLICT', details: { reason, contractId: 'contract-1' } },
    });
  });
});
