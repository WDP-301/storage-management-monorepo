import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { ContractStatus, InvoiceStatus, StorageUnitStatus, UserRole } from '@storage/types';
import { In } from 'typeorm';
import { ContractCancelService } from './contract-cancel.service';

const actor = (id: string, roles: UserRole[]): AuthUser => ({ id, roles }) as AuthUser;

describe('ContractCancelService.cancelDraft', () => {
  let em: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    insert: jest.Mock;
    query: jest.Mock;
  };
  let contract: Partial<Contract> | null;
  let notifications: { createForUsers: jest.Mock };
  let service: ContractCancelService;

  /** em.query answers by SQL shape: payments list, deposit lock/move/insert. */
  const answeringQuery = (rows: {
    payments?: unknown[];
    deposit?: { id: string; amount: string; heldAmount: string } | null;
  }) =>
    jest.fn(async (sql: string) => {
      if (sql.includes('FROM payments p JOIN invoices')) return rows.payments ?? [];
      if (sql.includes('FROM deposits d WHERE d.contract_id')) return [];
      // UPDATE ... RETURNING answers [rows, affected] through the postgres driver.
      if (sql.includes('UPDATE deposits')) return [[], 0];
      if (sql.includes('INSERT INTO deposits'))
        return rows.deposit
          ? [
              {
                id: rows.deposit.id,
                contractId: 'contract-1',
                paymentId: 'pay-dep',
                amount: rows.deposit.amount,
                heldAmount: rows.deposit.heldAmount,
                status: 'HELD',
              },
            ]
          : [];
      return [];
    });

  beforeEach(() => {
    contract = {
      id: 'contract-1',
      contractNo: 'CT-1',
      customerId: 'customer-1',
      bookingItemId: 'item-1',
      status: ContractStatus.DRAFT,
    };
    em = {
      findOne: jest.fn(async (entity) => (entity === Contract ? contract : null)),
      findOneOrFail: jest.fn(async (entity) =>
        entity === BookingItem
          ? { storageUnitId: 'unit-1', storageUnit: { facilityId: 'facility-1' } }
          : null,
      ),
      find: jest.fn(async (entity, options) =>
        entity === UserRoleAssignment && options.where.userId === 'manager-1'
          ? [
              {
                userId: 'manager-1',
                role: UserRole.FACILITY_MANAGER,
                facilityId: 'facility-1',
                startsAt: new Date('2024-01-01T00:00:00Z'),
                endsAt: null,
              },
            ]
          : [],
      ),
      update: jest.fn(async () => ({ affected: 1 })),
      insert: jest.fn(async () => ({})),
      query: answeringQuery({}),
    };
    notifications = { createForUsers: jest.fn(async () => undefined) };
    service = new ContractCancelService(
      {
        transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
      } as never,
      notifications as never,
    );
  });

  it('cancels the draft and puts the unit back on the market', async () => {
    const result = await service.cancelDraft(
      'contract-1',
      actor('manager-1', [UserRole.FACILITY_MANAGER]),
    );

    expect(result.status).toBe(ContractStatus.CANCELLED);
    expect(em.update).toHaveBeenCalledWith(
      Contract,
      { id: 'contract-1' },
      { status: ContractStatus.CANCELLED },
    );
    expect(em.update).toHaveBeenCalledWith(
      StorageUnit,
      { id: 'unit-1', status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
      { status: StorageUnitStatus.AVAILABLE },
    );
    // Only an invoice nobody paid is voided; money taken waits for a manual refund.
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { contractId: 'contract-1', status: InvoiceStatus.ISSUED },
      { status: InvoiceStatus.VOID },
    );
  });

  it('refuses a contract that already started', async () => {
    contract = { ...contract, status: ContractStatus.ACTIVE };

    await expect(
      service.cancelDraft('contract-1', actor('ops-1', [UserRole.OPERATIONS_MANAGER])),
    ).rejects.toMatchObject({ status: 409 });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('refuses a manager of another facility', async () => {
    await expect(
      service.cancelDraft('contract-1', actor('manager-2', [UserRole.FACILITY_MANAGER])),
    ).rejects.toMatchObject({ status: 403 });
    expect(em.update).not.toHaveBeenCalled();
  });

  it('queues a refund settlement when money was taken', async () => {
    em.query = answeringQuery({
      deposit: { id: 'dep-1', amount: '5000000', heldAmount: '5000000' },
      payments: [
        {
          payment_id: 'pay-1',
          amount: 2_500_000,
          invoice_id: 'inv-1',
          invoice_no: 'INV-1',
        },
      ],
    });

    await service.cancelDraft('contract-1', actor('manager-1', [UserRole.FACILITY_MANAGER]));

    expect(em.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        contractId: 'contract-1',
        depositId: 'dep-1',
        status: 'AWAITING_REFUND',
        depositAmount: 5_000_000,
        creditsTotal: 2_500_000,
        refundAmount: 7_500_000,
        approvedBy: 'manager-1',
      }),
    );
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({
        type: 'CONTRACT_CANCELLED',
        data: expect.objectContaining({ refundAmount: 7_500_000 }),
      }),
    );
  });

  it('skips the settlement but still notifies when nothing was paid', async () => {
    await service.cancelDraft('contract-1', actor('manager-1', [UserRole.FACILITY_MANAGER]));

    expect(em.insert).not.toHaveBeenCalled();
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({
        type: 'CONTRACT_CANCELLED',
        data: expect.objectContaining({ settlementId: null, refundAmount: 0 }),
      }),
    );
  });
});
