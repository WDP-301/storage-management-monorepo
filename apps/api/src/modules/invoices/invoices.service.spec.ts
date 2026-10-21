import { Invoice } from '@entities/invoice.entity';
import { ConfigService } from '@nestjs/config';
import { ContractStatus, InvoiceKind, InvoiceStatus } from '@storage/types';
import { Not } from 'typeorm';
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
      // The contract re-read under FOR SHARE: still ACTIVE unless a test says otherwise.
      query: jest.fn().mockResolvedValue([{ status: ContractStatus.ACTIVE }]),
      findOne: jest.fn(),
      save: jest.fn(async (_entityClass, data) => ({ id: 'new-inv-id', ...data })),
      create: jest.fn((_entityClass, data) => data),
    };

    dataSource = {
      transaction: jest.fn(async (cb) => cb(em)),
      // Succeeded payments summed per invoice: none unless a test says otherwise.
      query: jest.fn().mockResolvedValue([]),
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
      createForUsers: jest.fn().mockResolvedValue(1),
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
      expect(notificationsService.createForUsers).toHaveBeenCalledWith(
        em,
        ['customer-1'],
        expect.objectContaining({
          type: 'INVOICE_ISSUED',
        }),
      );
      expect(queueService.send).toHaveBeenCalledWith('invoice.render-pdf', {
        invoiceId: 'new-inv-id',
      });
      expect(em.query).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE'), ['contract-1']);
      // A settlement invoice never stands in for the rent period.
      expect(em.findOne).toHaveBeenCalledWith(Invoice, {
        where: {
          contractId: 'contract-1',
          periodNo: 2,
          status: Not(InvoiceStatus.VOID),
          kind: Not(InvoiceKind.SETTLEMENT),
        },
      });

      jest.useRealTimers();
    });

    it.each([
      ['ended by a return finalized after the scan', [{ status: ContractStatus.ENDED }]],
      ['deleted after the scan', []],
    ])('issues nothing for a contract %s', async (_label, rows) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-28'));
      contractsRepo.find.mockResolvedValue([
        {
          id: 'contract-1',
          contractNo: 'CT-0001',
          customerId: 'customer-1',
          status: ContractStatus.ACTIVE,
          effectiveAt: new Date('2026-11-01'),
          months: 3,
          monthlyPriceSnapshot: '1500000.00',
        },
      ]);
      em.query.mockResolvedValue(rows);
      em.findOne.mockResolvedValue(null);

      const result = await service.generateRecurringInvoices(5);

      expect(result.issuedCount).toBe(0);
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.save).not.toHaveBeenCalled();
      expect(notificationsService.createForUsers).not.toHaveBeenCalled();
      expect(queueService.send).not.toHaveBeenCalled();

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
      expect(notificationsService.createForUsers).not.toHaveBeenCalled();
      expect(queueService.send).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('getMyInvoices', () => {
    const invoice = (over: Record<string, unknown> = {}) => ({
      id: 'inv-1',
      invoiceNo: 'INV-1234',
      status: InvoiceStatus.ISSUED,
      total: '1500000.00',
      ...over,
    });

    it('returns invoices with a payment QR for the full amount when nothing is paid', async () => {
      invoicesRepo.findAndCount.mockResolvedValue([[invoice()], 1]);

      const res = await service.getMyInvoices('cust-1');

      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({ paidAmount: 0, amountDue: 1500000 });
      expect(res.items[0].paymentQrUrl).toContain('img.vietqr.io');
      expect(res.items[0].paymentQrUrl).toContain('amount=1500000&');
    });

    it('asks only for what is still due, deposit offsets included', async () => {
      invoicesRepo.findAndCount.mockResolvedValue([
        [
          invoice({ status: InvoiceStatus.PARTIALLY_PAID }),
          invoice({ id: 'inv-2', status: InvoiceStatus.PAID }),
        ],
        2,
      ]);
      dataSource.query.mockResolvedValue([
        { invoiceId: 'inv-1', paid: '1000000.00' },
        { invoiceId: 'inv-2', paid: '1500000.00' },
      ]);

      const { items } = await service.getMyInvoices('cust-1');

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY invoice_id'),
        [['inv-1', 'inv-2'], 'SUCCEEDED'],
      );
      expect(items[0]).toMatchObject({ paidAmount: 1000000, amountDue: 500000 });
      expect(items[0].paymentQrUrl).toContain('amount=500000&');
      expect(items[1]).toMatchObject({ amountDue: 0, paymentQrUrl: null });
    });

    it('offers no QR when an open invoice has nothing left to pay', async () => {
      invoicesRepo.findAndCount.mockResolvedValue([[invoice()], 1]);
      dataSource.query.mockResolvedValue([{ invoiceId: 'inv-1', paid: '1500000.00' }]);
      const { items } = await service.getMyInvoices('cust-1');
      expect(items[0].paymentQrUrl).toBeNull();
    });

    it.each([InvoiceStatus.VOID, InvoiceStatus.DRAFT, InvoiceStatus.PAID])(
      'owes nothing and offers no QR on a %s invoice, whatever was paid on it',
      async (status) => {
        invoicesRepo.findAndCount.mockResolvedValue([[invoice({ status })], 1]);
        dataSource.query.mockResolvedValue([{ invoiceId: 'inv-1', paid: '200000.00' }]);

        const { items } = await service.getMyInvoices('cust-1');

        expect(items[0]).toMatchObject({ paidAmount: 200000, amountDue: 0, paymentQrUrl: null });
      },
    );

    it('narrows to one contract', async () => {
      invoicesRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.getMyInvoices('cust-1', { contractId: 'contract-1' });
      expect(invoicesRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'cust-1', contractId: 'contract-1' } }),
      );
      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });

  it('builds the invoice detail QR from the amount still due', async () => {
    invoicesRepo.findOne.mockResolvedValue({
      id: 'inv-1',
      invoiceNo: 'INV-1234',
      customerId: 'cust-1',
      status: InvoiceStatus.PARTIALLY_PAID,
      total: 300000,
    });
    invoiceItemsRepo.find.mockResolvedValue([]);
    dataSource.query.mockResolvedValue([{ invoiceId: 'inv-1', paid: '100000' }]);

    const res = await service.getInvoiceById('inv-1', {
      id: 'cust-1',
      roles: ['CUSTOMER'],
    } as never);

    expect(res).toMatchObject({ paidAmount: 100000, amountDue: 200000, items: [] });
    expect(res.paymentQrUrl).toContain('amount=200000&');
  });
});
