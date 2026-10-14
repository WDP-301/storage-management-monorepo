import { ConfigService } from '@nestjs/config';
import { ContractStatus, InvoiceStatus } from '@storage/types';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoicesRepo: any;
  let invoiceItemsRepo: any;
  let contractsRepo: any;
  let dataSource: any;
  let queueService: any;
  let configService: any;
  let notificationsService: any;
  let em: any;

  beforeEach(() => {
    invoicesRepo = {
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    invoiceItemsRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };

    contractsRepo = {
      find: jest.fn(),
    };

    em = {
      findOne: jest.fn(),
      save: jest.fn(async (_entityClass, data) => ({ id: 'new-inv-id', ...data })),
      create: jest.fn((_entityClass, data) => data),
    };

    dataSource = {
      transaction: jest.fn(async (cb) => cb(em)),
    };

    queueService = {
      send: jest.fn().mockResolvedValue('job-123'),
    };

    configService = {
      get: jest.fn((key) => {
        if (key === 'SEPAY_BANK_ID') return 'MB';
        if (key === 'SEPAY_ACCOUNT_NO') return '0123456789';
        if (key === 'SEPAY_ACCOUNT_NAME') return 'STORAGE CO';
        return null;
      }),
    };

    notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    service = new InvoicesService(
      invoicesRepo,
      invoiceItemsRepo,
      contractsRepo,
      dataSource,
      queueService,
      configService as ConfigService,
      notificationsService,
    );
  });

  describe('generateRecurringInvoices', () => {
    it('scans active contracts and issues invoice for upcoming periods', async () => {
      const now = new Date('2026-11-28');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const activeContract = {
        id: 'contract-1',
        contractNo: 'CT-0001',
        customerId: 'customer-1',
        status: ContractStatus.ACTIVE,
        effectiveAt: new Date('2026-11-01'),
        months: 3,
        monthlyPriceSnapshot: '1500000.00',
        bookingItem: { storageUnitId: 'unit-1', storageUnit: { code: 'A101' } },
      };

      contractsRepo.find.mockResolvedValue([activeContract]);
      // period 2 does not have invoice yet
      em.findOne.mockResolvedValue(null);

      const result = await service.generateRecurringInvoices(5);

      expect(result.issuedCount).toBe(1);
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'customer-1',
          type: 'INVOICE_ISSUED',
        }),
      );
      expect(queueService.send).toHaveBeenCalledWith('invoice.render-pdf', {
        invoiceId: 'new-inv-id',
      });

      jest.useRealTimers();
    });

    it('skips when invoice for that period already exists', async () => {
      const now = new Date('2026-11-28');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const activeContract = {
        id: 'contract-1',
        contractNo: 'CT-0001',
        customerId: 'customer-1',
        status: ContractStatus.ACTIVE,
        effectiveAt: new Date('2026-11-01'),
        months: 3,
        monthlyPriceSnapshot: '1500000.00',
      };

      contractsRepo.find.mockResolvedValue([activeContract]);
      // Invoice already exists
      em.findOne.mockResolvedValue({ id: 'existing-inv' });

      const result = await service.generateRecurringInvoices(5);

      expect(result.issuedCount).toBe(0);
      expect(notificationsService.create).not.toHaveBeenCalled();
      expect(queueService.send).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('getMyInvoices', () => {
    it('returns invoices with payment QR attached for payable status', async () => {
      invoicesRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'inv-1',
            invoiceNo: 'INV-1234',
            status: InvoiceStatus.ISSUED,
            total: 1500000,
          },
        ],
        1,
      ]);

      const res = await service.getMyInvoices('cust-1');

      expect(res.total).toBe(1);
      expect(res.items[0].paymentQrUrl).toContain('img.vietqr.io');
    });
  });
});
