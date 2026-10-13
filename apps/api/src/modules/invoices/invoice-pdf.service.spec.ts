import { Invoice } from '@entities/invoice.entity';
import { InvoiceStatus } from '@storage/types';
import { formatVndCurrency, InvoicePdfService, sanitizePdfText } from './invoice-pdf.service';

describe('InvoicePdfService', () => {
  let service: InvoicePdfService;
  let configService: any;
  let uploadService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key) => {
        if (key === 'SEPAY_BANK_ID') return 'MB';
        if (key === 'SEPAY_ACCOUNT_NO') return '0123456789';
        if (key === 'SEPAY_ACCOUNT_NAME') return 'STORAGE CO';
        return null;
      }),
    };

    uploadService = {
      uploadBuffer: jest.fn(async (fileKey, buffer) => ({
        key: fileKey,
        publicUrl: `https://storage.local/${fileKey}`,
        bucket: 'test-bucket',
        size: buffer.length,
      })),
    };

    service = new InvoicePdfService(configService, uploadService);
  });

  it('sanitizes Vietnamese diacritics for standard font compatibility', () => {
    expect(sanitizePdfText('Hóa đơn tiền thuê kho')).toBe('Hoa don tien thue kho');
    expect(sanitizePdfText('Đoàn Minh Tài')).toBe('Doan Minh Tai');
  });

  it('formats currency correctly', () => {
    expect(formatVndCurrency(1500000)).toBe('1.500.000 VND');
  });

  it('renders a valid PDF buffer and uploads to S3', async () => {
    const invoice = {
      id: 'inv-1',
      invoiceNo: 'INV-1234567890-ABCD',
      customerId: 'cust-1',
      status: InvoiceStatus.ISSUED,
      periodNo: 2,
      months: 1,
      total: 2000000,
      subtotal: 2000000,
      createdAt: new Date(),
      dueAt: new Date(),
      customer: { fullName: 'Nguyen Van A', phone: '0901234567', email: 'test@example.com' },
      contract: { contractNo: 'CT-12345' },
    } as unknown as Invoice;

    const url = await service.generateAndUpload(invoice);

    expect(uploadService.uploadBuffer).toHaveBeenCalled();
    expect(url).toContain('https://storage.local/');
    const uploadedBuffer = uploadService.uploadBuffer.mock.calls[0][1];
    expect(Buffer.isBuffer(uploadedBuffer)).toBe(true);
    expect(uploadedBuffer.length).toBeGreaterThan(0);
    // PDF magic bytes %PDF
    expect(uploadedBuffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
