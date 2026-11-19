import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Deposit } from '@entities/deposit.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  ChangeRequestStatus,
  ContractStatus,
  DepositStatus,
  InspectionType,
  InvoiceStatus,
  NotificationType,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import { In, IsNull } from 'typeorm';
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
    // Both open and partially-paid invoices are voided; money taken waits for a manual refund.
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      {
        contractId: 'contract-1',
        status: In([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID]),
      },
      { status: InvoiceStatus.VOID },
    );
    expect(em.update).toHaveBeenCalledWith(
      Inspection,
      { contractId: 'contract-1', type: InspectionType.PRE_HANDOVER, finalizedAt: IsNull() },
      { inspectedBy: null },
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

  describe('no-show with the deposit kept', () => {
    const opsAssignment = {
      userId: 'ops-1',
      role: UserRole.OPERATIONS_MANAGER,
      facilityId: null,
      startsAt: new Date('2024-01-01T00:00:00Z'),
      endsAt: null,
    };
    const deposit = { id: 'dep-1', amount: '5000000', heldAmount: '5000000' };
    const rentPayment = {
      payment_id: 'pay-1',
      amount: 2_500_000,
      invoice_id: 'inv-1',
      invoice_no: 'INV-1',
    };

    beforeEach(() => {
      const managerOnly = em.find.getMockImplementation();
      em.find.mockImplementation(async (entity, options) =>
        entity === UserRoleAssignment && !options.where.userId
          ? [opsAssignment]
          : managerOnly?.(entity, options),
      );
    });

    it('keeps the deposit, refunds the rent paid and tells the back office', async () => {
      em.query = answeringQuery({ deposit, payments: [rentPayment] });

      await service.cancelDraft(
        'contract-1',
        actor('manager-1', [UserRole.FACILITY_MANAGER]),
        true,
      );

      expect(em.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'AWAITING_REFUND',
          depositAmount: 5_000_000,
          creditsTotal: 2_500_000,
          deductionsTotal: 5_000_000,
          refundAmount: 2_500_000,
          lines: expect.arrayContaining([
            expect.objectContaining({
              type: 'NO_SHOW_FORFEIT',
              direction: 'DEDUCTION',
              amount: 5_000_000,
            }),
          ]),
        }),
      );
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['ops-1'],
        expect.objectContaining({
          type: NotificationType.CONTRACT_REFUND_PENDING,
          data: expect.objectContaining({ refundAmount: 2_500_000 }),
        }),
      );
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        em,
        ['customer-1'],
        expect.objectContaining({
          type: NotificationType.CONTRACT_CANCELLED,
          data: expect.objectContaining({ refundAmount: 2_500_000, forfeitedAmount: 5_000_000 }),
        }),
      );
    });

    it('completes the settlement at once when nothing is left to refund', async () => {
      em.query = answeringQuery({ deposit });

      await service.cancelDraft(
        'contract-1',
        actor('manager-1', [UserRole.FACILITY_MANAGER]),
        true,
      );

      expect(em.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'COMPLETED',
          refundAmount: 0,
          deductionsTotal: 5_000_000,
          completedBy: 'manager-1',
          completedAt: expect.any(Date),
        }),
      );
      expect(em.update).toHaveBeenCalledWith(
        Deposit,
        { id: 'dep-1' },
        { heldAmount: 0, status: DepositStatus.FORFEITED },
      );
      expect(notifications.createForUsers).not.toHaveBeenCalledWith(
        em,
        expect.anything(),
        expect.objectContaining({ type: NotificationType.CONTRACT_REFUND_PENDING }),
      );
    });

    it('refunds everything when the manager does not keep the deposit', async () => {
      em.query = answeringQuery({ deposit });

      await service.cancelDraft('contract-1', actor('manager-1', [UserRole.FACILITY_MANAGER]));

      expect(em.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'AWAITING_REFUND',
          refundAmount: 5_000_000,
          deductionsTotal: 0,
        }),
      );
    });
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

  it('cancels a unit-change destination DRAFT in lockstep with its request without double-refunding the deposit', async () => {
    const changeReq = {
      id: 'req-1',
      contractId: 'contract-old',
      newContractId: 'contract-1',
      status: ChangeRequestStatus.AWAITING_HANDOVER,
      history: [],
    };
    const emSave = jest.fn(async (_entity, value) => value);
    (em as Record<string, unknown>).save = emSave;
    em.findOne.mockImplementation(async (entity) => {
      if (entity === Contract) return contract;
      if (entity === UnitChangeRequest) return changeReq;
      return null;
    });
    // Destination DRAFT has no deposit row (`deposit` stays null), only paid first-month rent.
    em.query = jest.fn(async (sql: string) => {
      if (sql.includes('UPDATE deposits')) return [[], 0];
      if (sql.includes('FROM payments p JOIN invoices')) {
        return [
          {
            payment_id: 'pay-rent',
            amount: 1_200_000,
            invoice_id: 'inv-rent',
            invoice_no: 'INV-R1',
          },
        ];
      }
      if (sql.includes('INSERT INTO deposits (contract_id')) {
        return [
          {
            id: 'dep-zero',
            contractId: 'contract-1',
            amount: '0',
            heldAmount: '0',
            status: 'HELD',
          },
        ];
      }
      return [];
    });

    await service.cancelDraft('contract-1', actor('manager-1', [UserRole.FACILITY_MANAGER]));

    expect(changeReq.status).toBe(ChangeRequestStatus.CANCELLED);
    expect(emSave).toHaveBeenCalledWith(UnitChangeRequest, changeReq);
    // Refunds ONLY the paid rent via a 0-deposit settlement — never the deposit held on contract-old.
    expect(em.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        contractId: 'contract-1',
        depositId: 'dep-zero',
        depositAmount: 0,
        creditsTotal: 1_200_000,
        refundAmount: 1_200_000,
      }),
    );
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({ type: NotificationType.UNIT_CHANGE_CANCELLED }),
    );
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({ type: NotificationType.CONTRACT_CANCELLED }),
    );
  });
});
