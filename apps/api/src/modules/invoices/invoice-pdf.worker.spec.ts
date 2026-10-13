import { InvoicePdfWorker } from './invoice-pdf.worker';

describe('InvoicePdfWorker', () => {
  let worker: InvoicePdfWorker;
  let queueService: any;
  let invoicePdfService: any;
  let invoicesRepo: any;
  let invoiceItemsRepo: any;
  let workerCallback: (job: { data: { invoiceId: string } }) => Promise<void>;

  beforeEach(() => {
    queueService = {
      work: jest.fn(async (_name, cb) => {
        workerCallback = cb;
      }),
    };

    invoicePdfService = {
      generateAndUpload: jest
        .fn()
        .mockResolvedValue('https://storage.example.com/invoices/INV-001.pdf'),
    };

    invoicesRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (inv) => inv),
    };

    invoiceItemsRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    worker = new InvoicePdfWorker(queueService, invoicePdfService, invoicesRepo, invoiceItemsRepo);
  });

  it('registers work handler onModuleInit', async () => {
    await worker.onModuleInit();
    expect(queueService.work).toHaveBeenCalledWith('invoice.render-pdf', expect.any(Function));
  });

  it('renders and attaches pdfUrl without sending notifications', async () => {
    await worker.onModuleInit();

    const invoice: any = {
      id: 'inv-1',
      invoiceNo: 'INV-001',
      customerId: 'cust-1',
      billingInfo: {},
    };
    invoicesRepo.findOne.mockResolvedValue(invoice);

    await workerCallback({ data: { invoiceId: 'inv-1' } });

    expect(invoicePdfService.generateAndUpload).toHaveBeenCalledWith(invoice, []);
    expect(invoicesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'inv-1',
        billingInfo: expect.objectContaining({
          pdfUrl: 'https://storage.example.com/invoices/INV-001.pdf',
        }),
      }),
    );
  });

  it('gracefully skips if invoice is not found', async () => {
    await worker.onModuleInit();
    invoicesRepo.findOne.mockResolvedValue(null);

    await workerCallback({ data: { invoiceId: 'unknown-id' } });

    expect(invoicePdfService.generateAndUpload).not.toHaveBeenCalled();
    expect(invoicesRepo.save).not.toHaveBeenCalled();
  });
});
