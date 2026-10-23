import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { Notification } from '@entities/notification.entity';
import { Payment } from '@entities/payment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import {
  ContractStatus,
  InspectionType,
  InvoiceItemType,
  InvoiceStatus,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  RentalPeriodKind,
  UserRole,
} from '@storage/types';
import { FirstRentService } from './first-rent.service';

const actor = (id: string, roles: UserRole[] = [UserRole.FACILITY_STAFF]): AuthUser =>
  ({ id, roles }) as AuthUser;
const STAFF = actor('staff-1');

describe('FirstRentService', () => {
  let contract: Partial<Contract> | null;
  let invoices: Partial<Invoice>[];
  let payments: Partial<Payment>[];
  let em: Record<string, jest.Mock>;
  let service: FirstRentService;

  const live = () => invoices.find((i) => i.status !== InvoiceStatus.VOID) ?? null;

  beforeEach(() => {
    contract = {
      id: 'contract-1',
      contractNo: 'CT-1',
      customerId: 'customer-1',
      bookingItemId: 'item-1',
      status: ContractStatus.DRAFT,
      monthlyPriceSnapshot: 1500000,
    };
    invoices = [];
    payments = [];
    const repo = (entity: unknown) => ({
      find: jest.fn(async () => {
        if (entity === Inspection) {
          return [
            {
              id: 'insp-1',
              contractId: 'contract-1',
              type: InspectionType.PRE_HANDOVER,
              inspectedBy: 'staff-1',
            },
          ];
        }
        if (entity === Invoice) return invoices.filter((i) => i.status !== InvoiceStatus.VOID);
        return payments;
      }),
      sum: jest.fn(async () => payments.reduce((sum, p) => sum + Number(p.amount), 0)),
    });
    em = {
      findOne: jest.fn(async (entity) => {
        if (entity === Contract) return contract;
        if (entity === Invoice) return live();
        if (entity === BookingItem) return { storageUnit: { facilityId: 'facility-1' } };
        return null;
      }),
      findOneOrFail: jest.fn(async () => ({
        id: 'item-1',
        storageUnitId: 'unit-1',
        storageUnit: { code: 'HCM-01', facilityId: 'facility-1' },
      })),
      // Nobody manages a facility unless they are a global manager.
      find: jest.fn(async () => []),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (entity, data) => {
        if (entity === Invoice) invoices.push({ id: 'inv-1', ...data });
        if (entity === Payment) payments.push({ ...data, invoiceId: data.invoiceId });
        return { id: entity === Invoice ? 'inv-1' : 'row', ...data };
      }),
      update: jest.fn(async (entity, where, patch) => {
        if (entity === Invoice) Object.assign(invoices.find((i) => i.id === where.id) ?? {}, patch);
        return { affected: 1 };
      }),
      getRepository: jest.fn(repo),
      insert: jest.fn(async () => ({ identifiers: [] })),
    };
    const dataSource = {
      transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)),
      getRepository: em.getRepository,
    };
    const config = { get: jest.fn((key: string) => `cfg-${key}`) };
    service = new FirstRentService(
      dataSource as never,
      config as never,
      // Real service: notifications are written through the transaction's `em.insert`.
      new NotificationsService({} as never),
    );
  });

  describe('issue', () => {
    const notified = () =>
      em.insert.mock.calls
        .filter(([entity]) => entity === Notification)
        .flatMap(([, rows]) => rows as Array<Record<string, unknown>>);

    it('tells the customer to pay, with the contract to open', async () => {
      await service.issue('contract-1', STAFF);

      expect(notified()).toEqual([
        expect.objectContaining({
          userId: 'customer-1',
          type: NotificationType.INVOICE_ISSUED,
          title: 'Thanh toán tiền thuê tháng đầu',
          data: expect.objectContaining({ invoiceId: 'inv-1', contractId: 'contract-1' }),
        }),
      ]);
    });

    it('sends nothing for a free unit, settled from the start', async () => {
      contract = { ...contract, monthlyPriceSnapshot: 0 };

      await service.issue('contract-1', STAFF);

      expect(notified()).toEqual([]);
    });

    it('does not notify again when the invoice was already issued', async () => {
      await service.issue('contract-1', STAFF);
      em.insert.mockClear();

      await service.issue('contract-1', STAFF);

      expect(notified()).toEqual([]);
    });

    it('bills one month of the contract price and returns a QR carrying the invoice number', async () => {
      const summary = await service.issue('contract-1', STAFF);

      expect(em.save).toHaveBeenCalledWith(
        Invoice,
        expect.objectContaining({
          customerId: 'customer-1',
          contractId: 'contract-1',
          kind: RentalPeriodKind.INITIAL,
          periodNo: 1,
          months: 1,
          status: InvoiceStatus.ISSUED,
          subtotal: 1500000,
          taxAmount: 0,
          total: 1500000,
        }),
      );
      expect(invoices[0].dueAt).toBeUndefined();
      expect(em.save).toHaveBeenCalledWith(
        InvoiceItem,
        expect.objectContaining({
          invoiceId: 'inv-1',
          storageUnitId: 'unit-1',
          itemType: InvoiceItemType.RENT,
          amount: 1500000,
        }),
      );
      const invoiceNo = invoices[0].invoiceNo as string;
      expect(invoiceNo).toMatch(/^INV-\d{13}-[0-9A-F]{4}$/);
      expect(summary).toMatchObject({
        invoice_no: invoiceNo,
        status: InvoiceStatus.ISSUED,
        amount_due: 1500000,
        payment_qr_url: expect.stringContaining(`amount=1500000&addInfo=${invoiceNo}`),
      });
    });

    it('returns the invoice already issued instead of billing twice', async () => {
      await service.issue('contract-1', STAFF);
      em.save.mockClear();

      const summary = await service.issue('contract-1', STAFF);

      expect(em.save).not.toHaveBeenCalled();
      expect(summary.invoice_id).toBe('inv-1');
    });

    it('settles a free unit at once', async () => {
      contract = { ...contract, monthlyPriceSnapshot: 0 };

      const summary = await service.issue('contract-1', STAFF);

      expect(summary).toMatchObject({ status: InvoiceStatus.PAID, payment_qr_url: null });
    });

    it('refuses once the contract left DRAFT', async () => {
      contract = { ...contract, status: ContractStatus.ACTIVE };

      await expect(service.issue('contract-1', STAFF)).rejects.toMatchObject({ status: 409 });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('refuses staff not assigned to the handover', async () => {
      await expect(service.issue('contract-1', actor('staff-2'))).rejects.toMatchObject({
        status: 403,
      });
    });

    it('refuses a missing contract', async () => {
      contract = null;
      await expect(service.issue('contract-1', STAFF)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('confirmCash', () => {
    it('records the amount still due as cash and settles the invoice', async () => {
      await service.issue('contract-1', STAFF);
      payments.push({ invoiceId: 'inv-1', amount: 500000, method: PaymentMethod.BANK_TRANSFER });

      const summary = await service.confirmCash('contract-1', STAFF);

      expect(em.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({
          invoiceId: 'inv-1',
          customerId: 'customer-1',
          type: PaymentType.RENT,
          method: PaymentMethod.CASH,
          status: PaymentStatus.SUCCEEDED,
          amount: 1000000,
          metadata: { confirmedBy: 'staff-1' },
        }),
      );
      expect(summary).toMatchObject({
        status: InvoiceStatus.PAID,
        amount_due: 0,
        method: PaymentMethod.CASH,
        payment_qr_url: null,
      });
    });

    it('does nothing more when a transfer already settled the invoice', async () => {
      await service.issue('contract-1', STAFF);
      invoices[0].status = InvoiceStatus.PAID;
      em.save.mockClear();

      await service.confirmCash('contract-1', STAFF);

      expect(em.save).not.toHaveBeenCalled();
    });

    it('asks for the invoice first', async () => {
      await expect(service.confirmCash('contract-1', STAFF)).rejects.toMatchObject({
        status: 409,
      });
    });
  });
});
