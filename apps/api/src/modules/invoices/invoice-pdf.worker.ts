import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { QueueService } from '@modules/queue/queue.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatDateStr, formatVndCurrency, InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class InvoicePdfWorker implements OnModuleInit {
  private readonly logger = new Logger(InvoicePdfWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItems: Repository<InvoiceItem>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.work<{ invoiceId: string }>('invoice.render-pdf', async (job) => {
      await this.handleRenderPdfJob(job.data.invoiceId);
    });
  }

  private async handleRenderPdfJob(invoiceId: string): Promise<void> {
    this.logger.log(`Processing invoice PDF generation for invoiceId: ${invoiceId}`);

    const invoice = await this.invoices.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
        contract: true,
      },
    });

    if (!invoice) {
      this.logger.warn(`Invoice ${invoiceId} not found, skipping PDF generation`);
      return;
    }

    const items = await this.invoiceItems.find({ where: { invoiceId } });

    try {
      // 1. Render and upload PDF
      const pdfUrl = await this.invoicePdfService.generateAndUpload(invoice, items);

      // 2. Save PDF URL into billingInfo as requested
      invoice.billingInfo = {
        ...(invoice.billingInfo ?? {}),
        pdfUrl,
        pdfGeneratedAt: new Date().toISOString(),
      };
      await this.invoices.save(invoice);

      // 3. Send in-app notification to the customer
      await this.notificationsService.create({
        userId: invoice.customerId,
        title: `Hóa đơn tiền thuê kho kỳ ${invoice.periodNo}`,
        body: `Hóa đơn ${invoice.invoiceNo} với số tiền ${formatVndCurrency(invoice.total)} đã được phát hành. Hạn thanh toán đến ${formatDateStr(invoice.dueAt)}. Vui lòng thanh toán đúng hạn.`,
        type: 'INVOICE_ISSUED',
        data: {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          pdfUrl,
          total: invoice.total,
          dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
        },
      });

      this.logger.log(
        `PDF generation and customer notification completed for invoice ${invoice.invoiceNo}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to render PDF or notify customer for invoice ${invoice.invoiceNo}: ${err?.message || err}`,
        err?.stack,
      );
      throw err; // Re-throw so pg-boss can track failure / retry
    }
  }
}
