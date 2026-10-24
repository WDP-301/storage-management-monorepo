import { ContractSettlement } from '@entities/contract-settlement.entity';
import { Deposit } from '@entities/deposit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { DepositStatus, NotificationType, SettlementStatus, UserRole } from '@storage/types';
import { SettlementRefundService } from './settlement-refund.service';

const ADMIN = { id: 'admin-1', roles: [UserRole.ADMIN] } as unknown as AuthUser;
const PROOF = { fileKey: 'uploads/1-ck.jpg', name: 'ck.jpg', mimeType: 'image/jpeg' };

describe('SettlementRefundService', () => {
  let settlement: Record<string, unknown> | null;
  let em: Record<string, jest.Mock>;
  let notifications: { createForUsers: jest.Mock };
  let service: SettlementRefundService;

  beforeEach(() => {
    settlement = {
      id: 'settlement-1',
      contractId: 'contract-1',
      depositId: 'dep-1',
      status: SettlementStatus.AWAITING_REFUND,
      depositAmount: '2000000.00',
      creditsTotal: '1000000.00',
      refundAmount: '1500000.00',
      note: 'Duyệt',
      bankAccount: {
        bankBin: '970436',
        bankName: 'VCB',
        accountNo: '0123456789',
        accountName: 'A',
      },
    };
    em = {
      findOne: jest.fn(async () => settlement),
      findOneOrFail: jest.fn(async () => ({
        id: 'contract-1',
        contractNo: 'CT-1',
        customerId: 'c-1',
      })),
      exists: jest.fn(async () => false),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    notifications = { createForUsers: jest.fn(async () => 1) };
    service = new SettlementRefundService(
      { transaction: jest.fn((cb) => cb(em)) } as never,
      notifications as never,
      { detail: jest.fn(async () => ({ status: 'COMPLETED' })) } as never,
    );
  });

  it('completes the settlement and releases the deposit with the status the refund gives it', async () => {
    await service.complete(
      'contract-1',
      { evidence: [PROOF], transferRef: ' FT123 ', note: 'Đã CK' },
      ADMIN,
    );

    expect(em.findOne).toHaveBeenCalledWith(ContractSettlement, {
      where: { contractId: 'contract-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(em.update).toHaveBeenCalledWith(
      ContractSettlement,
      { id: 'settlement-1' },
      expect.objectContaining({
        status: SettlementStatus.COMPLETED,
        transferRef: 'FT123',
        evidence: [PROOF],
        note: 'Duyệt\nĐã CK',
        completedBy: 'admin-1',
        completedAt: expect.any(Date),
      }),
    );
    // 1.5M refunded of which 1M were credits: half of the 2M deposit went back.
    expect(em.update).toHaveBeenCalledWith(
      Deposit,
      { id: 'dep-1' },
      { heldAmount: 0, status: DepositStatus.PARTIALLY_REFUNDED },
    );
    const [, users, payload] = notifications.createForUsers.mock.calls[0];
    expect(users).toEqual(['c-1']);
    expect(payload.type).toBe(NotificationType.REFUND_COMPLETED);
    expect(payload.body).toContain('••••6789');
    expect(payload.body).not.toContain('0123456789');
  });

  it('accepts evidence without a transfer reference', async () => {
    await service.complete('contract-1', { evidence: [PROOF] }, ADMIN);
    expect(em.update).toHaveBeenCalledWith(
      ContractSettlement,
      { id: 'settlement-1' },
      expect.objectContaining({ transferRef: null, evidence: [PROOF] }),
    );
  });

  it('needs at least one evidence file, even with a transfer reference', async () => {
    await expect(
      service.complete('contract-1', { transferRef: 'FT123', evidence: [] }, ADMIN),
    ).rejects.toMatchObject({
      status: 400,
      response: { details: { fields: [{ field: 'evidence', code: 'proofRequired' }] } },
    });
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it.each([
    ['already completed', { status: SettlementStatus.COMPLETED }],
    ['not approved yet', null],
  ])('refuses a settlement %s', async (_label, over) => {
    settlement = over && { ...settlement, ...over };
    await expect(
      service.complete('contract-1', { evidence: [PROOF], transferRef: 'FT1' }, ADMIN),
    ).rejects.toMatchObject({ status: 409, response: { code: 'REFUND_NOT_PENDING' } });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('refuses a transfer reference already used, also when a concurrent write catches it', async () => {
    em.exists.mockResolvedValueOnce(true);
    await expect(
      service.complete('contract-1', { evidence: [PROOF], transferRef: 'FT1' }, ADMIN),
    ).rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });

    em.update.mockRejectedValueOnce({ code: '23505' });
    await expect(
      service.complete('contract-1', { evidence: [PROOF], transferRef: 'FT1' }, ADMIN),
    ).rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
  });
});
