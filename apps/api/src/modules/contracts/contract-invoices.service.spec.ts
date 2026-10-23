import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { Notification } from '@entities/notification.entity';
import { Payment } from '@entities/payment.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import {
  InvoiceKind,
  InvoiceStatus,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  UserRole,
} from '@storage/types';
import { ContractInvoicesService } from './contract-invoices.service';

const actor = (id: string, roles: UserRole[]): AuthUser => ({ id, roles }) as AuthUser;
const OPS = actor('ops-1', [UserRole.OPERATIONS_MANAGER]);
const MANAGER = actor('manager-1', [UserRole.FACILITY_MANAGER]);
const PROOF = { fileKey: 'uploads/1-proof.jpg', name: 'proof.jpg', mimeType: 'image/jpeg' };

describe('ContractInvoicesService', () => {
  let invoice: Partial<Invoice>;
  let payments: Partial<Payment>[];
  let managedFacilities: string[];
  let usedRefs: string[];
  let contractStatus: string;
  let em: Record<string, jest.Mock>;
  let service: ContractInvoicesService;

  const record = (dto: Record<string, unknown>, who: AuthUser = OPS) =>
    service.recordPayment(
      'contract-1',
      'inv-2',
      { method: 'CASH', amount: 1_000_000, note: 'Khách trả tại quầy', ...dto } as never,
      who,
    );
  const inserted = (entity: unknown) =>
    em.save.mock.calls.filter(([e]) => e === entity).map(([, row]) => row);
  const notifications = () =>
    em.insert.mock.calls
      .filter(([entity]) => entity === Notification)
      .flatMap(([, rows]) => rows as Array<Record<string, unknown>>);

  beforeEach(() => {
    invoice = {
      id: 'inv-2',
      invoiceNo: 'INV-2',
      contractId: 'contract-1',
      customerId: 'customer-1',
      kind: InvoiceKind.RENEWAL,
      periodNo: 2,
      status: InvoiceStatus.ISSUED,
      total: 1_500_000,
      dueAt: new Date('2026-10-01T00:00:00Z'),
    };
    payments = [];
    managedFacilities = [];
    usedRefs = [];
    contractStatus = 'ACTIVE';
    em = {
      findOne: jest.fn(async (entity, options) => {
        if (entity === Contract) {
          return {
            id: 'contract-1',
            status: contractStatus,
            bookingItem: { storageUnit: { facilityId: 'facility-1' } },
          };
        }
        if (entity === Invoice) return options.where.id === invoice.id ? invoice : null;
        return null;
      }),
      find: jest.fn(async (entity) => {
        if (entity === UserRoleAssignment) {
          return managedFacilities.map((facilityId) => ({
            facilityId,
            role: UserRole.FACILITY_MANAGER,
            startsAt: new Date('2024-01-01T00:00:00Z'),
          }));
        }
        if (entity === Invoice) return [invoice];
        if (entity === Payment) return payments.map((p, i) => ({ id: `pay-${i}`, ...p }));
        if (entity === AppUser) return [{ id: 'ops-1', fullName: 'Ops One' }];
        return [];
      }),
      save: jest.fn(async (entity, row) => {
        if (entity === Payment) payments.push({ ...row, invoiceId: row.invoiceId });
        return row;
      }),
      update: jest.fn(async (entity, _where, patch) => {
        if (entity === Invoice) Object.assign(invoice, patch);
        return { affected: 1 };
      }),
      insert: jest.fn(async () => ({ identifiers: [] })),
      query: jest.fn(async (sql: string, params: string[]) =>
        sql.includes('FROM payments') && usedRefs.includes(params[0]) ? [{ '?column?': 1 }] : [],
      ),
      getRepository: jest.fn(() => ({
        sum: jest.fn(async () => payments.reduce((sum, p) => sum + Number(p.amount), 0)),
      })),
    };
    const dataSource = {
      manager: em,
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
    };
    service = new ContractInvoicesService(
      dataSource as never,
      new NotificationsService({} as never),
    );
  });

  describe('recordPayment', () => {
    it('settles the invoice with a cash payment that keeps who recorded it and why', async () => {
      const result = await record({ amount: 1_500_000 });

      expect(inserted(Payment)[0]).toMatchObject({
        invoiceId: 'inv-2',
        customerId: 'customer-1',
        type: PaymentType.RENT,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCEEDED,
        amount: 1_500_000,
        metadata: { confirmedBy: 'ops-1', note: 'Khách trả tại quầy' },
      });
      expect(invoice.status).toBe(InvoiceStatus.PAID);
      expect(result).toMatchObject({ status: InvoiceStatus.PAID, amount_due: 0 });
      expect(result.payments[0]).toMatchObject({
        is_manual: true,
        recorded_by: { id: 'ops-1', full_name: 'Ops One' },
      });
      expect(notifications()).toEqual([
        expect.objectContaining({ userId: 'customer-1', type: NotificationType.INVOICE_PAID }),
      ]);
    });

    it('leaves the invoice partially paid and tells nobody when money is still due', async () => {
      const result = await record({ amount: 500_000 });

      expect(invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(result).toMatchObject({ paid_amount: 500_000, amount_due: 1_000_000 });
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('stores the transfer reference and proof photos of a bank transfer', async () => {
      await record({
        method: 'BANK_TRANSFER',
        amount: 1_500_000,
        transferRef: 'FT2610201234',
        evidence: [PROOF],
      });

      expect(inserted(Payment)[0]).toMatchObject({
        method: PaymentMethod.BANK_TRANSFER,
        metadata: { transferRef: 'FT2610201234', evidence: [PROOF] },
      });
    });

    it('bills a settlement invoice as a fee', async () => {
      invoice.kind = InvoiceKind.SETTLEMENT;

      await record({ amount: 1_500_000 });

      expect(inserted(Payment)[0]).toMatchObject({ type: PaymentType.FEE });
    });

    it('refuses a bank transfer with neither reference nor proof', async () => {
      await expect(record({ method: 'BANK_TRANSFER' })).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'transferRef', code: 'proofRequired' }] } },
      });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('refuses more than the amount still due', async () => {
      payments.push({ invoiceId: 'inv-2', amount: 1_000_000, metadata: {} });

      await expect(record({ amount: 600_000 })).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'amount', code: 'exceedsDue' }] } },
      });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('refuses a reference already recorded for another payment', async () => {
      usedRefs = ['FT-DUP'];

      await expect(
        record({ method: 'BANK_TRANSFER', transferRef: 'FT-DUP' }),
      ).rejects.toMatchObject({ status: 409 });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('compares references without case or spaces, against SePay bank references too', async () => {
      usedRefs = ['FT2610201234'];

      await expect(
        record({ method: 'BANK_TRANSFER', transferRef: ' ft 2610 201234 ' }),
      ).rejects.toMatchObject({ status: 409 });
      const [sql] = em.query.mock.calls.find(([q]) => String(q).includes('FROM payments')) ?? [];
      expect(sql).toContain("metadata->>'referenceCode'");
      expect(sql).not.toContain('provider_ref');
    });

    it('settles a total with cents by rounding the last payment up to whole VND', async () => {
      invoice.total = 300_000.5;

      const result = await record({ amount: 300_001 });

      expect(invoice.status).toBe(InvoiceStatus.PAID);
      expect(result.amount_due).toBe(0);
    });

    it('shows a total with cents as the rounded-up amount still due', async () => {
      invoice.total = 300_000.5;
      payments.push({ invoiceId: 'inv-2', amount: 100_000, metadata: {} });

      const [row] = await service.list('contract-1', OPS);

      expect(row.amount_due).toBe(200_001);
    });

    it('refuses money on a cancelled contract', async () => {
      contractStatus = 'CANCELLED';

      await expect(record({})).rejects.toMatchObject({ status: 409 });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('refuses a payment received in the future', async () => {
      await expect(record({ paidAt: '2999-01-01T00:00:00Z' })).rejects.toMatchObject({
        status: 400,
        response: { details: { fields: [{ field: 'paidAt', code: 'future' }] } },
      });
    });

    it.each([InvoiceStatus.PAID, InvoiceStatus.VOID])(
      'refuses an invoice that is %s',
      async (status) => {
        invoice.status = status;

        await expect(record({})).rejects.toMatchObject({ status: 409 });
        expect(em.save).not.toHaveBeenCalled();
      },
    );

    it('reports an invoice of another contract as missing', async () => {
      await expect(
        service.recordPayment('contract-1', 'inv-other', { amount: 1 } as never, OPS),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('lets a facility manager record on a contract of their facility', async () => {
      managedFacilities = ['facility-1'];

      await expect(record({}, MANAGER)).resolves.toMatchObject({
        status: InvoiceStatus.PARTIALLY_PAID,
      });
    });

    it('forbids a facility manager of another facility', async () => {
      managedFacilities = ['facility-2'];

      await expect(record({}, MANAGER)).rejects.toMatchObject({ status: 403 });
      expect(em.save).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('flags an unpaid invoice past its due date and labels SePay payments as automatic', async () => {
      payments.push({
        invoiceId: 'inv-2',
        amount: 500_000,
        method: PaymentMethod.BANK_TRANSFER,
        providerRef: '987654',
        metadata: {},
      });
      invoice.status = InvoiceStatus.PARTIALLY_PAID;

      const [row] = await service.list('contract-1', OPS);

      expect(row).toMatchObject({ is_overdue: true, paid_amount: 500_000, amount_due: 1_000_000 });
      expect(row.payments[0]).toMatchObject({
        is_manual: false,
        transfer_ref: '987654',
        recorded_by: null,
      });
    });

    it('shows a transfer that landed on a settled invoice as needing review', async () => {
      invoice.status = InvoiceStatus.PAID;
      payments.push({
        invoiceId: 'inv-2',
        amount: 1_500_000,
        metadata: { needsReview: 'invoice PAID' },
      });

      const [row] = await service.list('contract-1', OPS);

      expect(row.is_overdue).toBe(false);
      expect(row.amount_due).toBe(0);
      expect(row.payments[0].note).toContain('Cần đối soát');
    });
  });
});
