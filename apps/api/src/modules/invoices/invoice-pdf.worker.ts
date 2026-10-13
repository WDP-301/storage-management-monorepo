import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { QueueService } from '@modules/queue/queue.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class InvoicePdfWorker implements OnModuleInit {
  private readonly logger = new Logger(InvoicePdfWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly invoicePdfService: InvoicePdfService,
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

      this.logger.log(
        `PDF generation completed for invoice ${invoice.invoiceNo} (pdfUrl: ${pdfUrl})`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to render PDF for invoice ${invoice.invoiceNo}: ${err?.message || err}`,
        err?.stack,
      );
      throw err; // Re-throw so pg-boss can track failure / retry
    }
  }
}
