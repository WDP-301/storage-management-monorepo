import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import { buildPaymentQrUrl } from '@modules/payments/vietqr.util';
import { QueueService } from '@modules/queue/queue.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  ContractStatus,
  InvoiceItemType,
  InvoiceStatus,
  NotificationType,
  RentalPeriodKind,
  UserRole,
} from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, Not, Repository } from 'typeorm';
import { formatDateStr, formatVndCurrency } from './invoice-pdf.service';

function invoiceIssuedNotification(invoice: Invoice): NotificationPayload {
  return {
    type: NotificationType.INVOICE_ISSUED,
    title: `Hóa đơn tiền thuê kho kỳ ${invoice.periodNo}`,
    body: `Hóa đơn ${invoice.invoiceNo} với số tiền ${formatVndCurrency(invoice.total)} đã được phát hành. Hạn thanh toán đến ${formatDateStr(invoice.dueAt)}. Vui lòng thanh toán đúng hạn.`,
    data: {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      total: invoice.total,
      dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    },
  };
}

export interface InvoiceWithQrResponse extends Invoice {
  paymentQrUrl?: string | null;
  items?: InvoiceItem[];
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItems: Repository<InvoiceItem>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Scans active contracts and issues recurring rental invoices for upcoming periods.
   * Can be invoked by Cron or manually by an administrator.
   */
  async generateRecurringInvoices(
    leadDays = 5,
  ): Promise<{ issuedCount: number; invoiceNos: string[] }> {
    const activeContracts = await this.contracts.find({
      where: { status: ContractStatus.ACTIVE },
      relations: { bookingItem: { storageUnit: true } },
    });

    const now = new Date();
    const issuedInvoiceNos: string[] = [];

    for (const contract of activeContracts) {
      if (!contract.effectiveAt || contract.months <= 1) continue;

      const effectiveStart = new Date(contract.effectiveAt);
      const monthlyPrice = new Decimal(contract.monthlyPriceSnapshot);
      if (monthlyPrice.lte(0)) continue;

      // Periods 2 to contract.months
      for (let period = 2; period <= contract.months; period++) {
        const periodStart = new Date(effectiveStart);
        periodStart.setMonth(periodStart.getMonth() + (period - 1));

        const periodEnd = new Date(effectiveStart);
        periodEnd.setMonth(periodEnd.getMonth() + period);

        // Calculate when to issue: leadDays before period starts
        const issueThreshold = new Date(periodStart);
        issueThreshold.setDate(issueThreshold.getDate() - leadDays);

        // If today is past the issue threshold and before period end
        if (now >= issueThreshold && now < periodEnd) {
          try {
            const invoice = await this.issuePeriodInvoiceIfAbsent(
              contract,
              period,
              periodStart,
              periodEnd,
              monthlyPrice,
              now,
            );

            if (invoice) {
              issuedInvoiceNos.push(invoice.invoiceNo);
              // Send background PDF generation job to pg-boss
              await this.queueService.send('invoice.render-pdf', {
                invoiceId: invoice.id,
              });
            }
          } catch (err: any) {
            this.logger.error(
              `Error issuing recurring invoice for contract ${contract.contractNo}, period ${period}: ${err?.message || err}`,
              err?.stack,
            );
          }
        }
      }
    }

    this.logger.log(
      `Recurring invoice scan finished: ${issuedInvoiceNos.length} new invoices issued`,
    );
    return { issuedCount: issuedInvoiceNos.length, invoiceNos: issuedInvoiceNos };
  }

  private async issuePeriodInvoiceIfAbsent(
    contract: Contract,
    periodNo: number,
    startAt: Date,
    endAt: Date,
    monthlyPrice: Decimal,
    now: Date,
  ): Promise<Invoice | null> {
    const savedInvoice = await this.dataSource.transaction(async (em) => {
      const existing = await em.findOne(Invoice, {
        where: {
          contractId: contract.id,
          periodNo,
          status: Not(InvoiceStatus.VOID),
        },
      });

      if (existing) {
        return null;
      }

      const invoice = em.create(Invoice, {
        invoiceNo: generateInvoiceNo(),
        customerId: contract.customerId,
        contractId: contract.id,
        periodNo,
        kind: contract.kind ?? RentalPeriodKind.INITIAL,
        startAt,
        endAt,
        months: 1,
        monthlyPriceSnapshot: monthlyPrice.toNumber(),
        status: InvoiceStatus.ISSUED,
        currency: 'VND',
        subtotal: monthlyPrice.toNumber(),
        taxAmount: 0,
        total: monthlyPrice.toNumber(),
        issuedAt: now,
        dueAt: startAt,
        billingInfo: {},
      });

      const saved = await em.save(Invoice, invoice);

      const unitCode = contract.bookingItem?.storageUnit?.code ?? '';
      const description =
        `Tiền thuê kỳ ${periodNo} — Kho ${unitCode} (HĐ: ${contract.contractNo})`.trim();

      const item = em.create(InvoiceItem, {
        invoiceId: saved.id,
        storageUnitId: contract.bookingItem?.storageUnitId,
        itemType: InvoiceItemType.RENT,
        description,
        quantity: 1,
        unitAmount: monthlyPrice.toNumber(),
        amount: monthlyPrice.toNumber(),
      });

      await em.save(InvoiceItem, item);

      await this.notificationsService.createForUsers(
        em,
        [saved.customerId],
        invoiceIssuedNotification(saved),
      );

      this.logger.log(
        `Issued recurring invoice ${saved.invoiceNo} for contract ${contract.contractNo}, period ${periodNo}`,
      );

      return saved;
    });

    return savedInvoice;
  }

  /**
   * Retrieves invoices belonging to the authenticated customer.
   */
  async getMyInvoices(
    customerId: string,
    options: { status?: InvoiceStatus; page?: number; limit?: number } = {},
  ): Promise<{ items: InvoiceWithQrResponse[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = { customerId };
    if (options.status) {
      where.status = options.status;
    }

    const [invoices, total] = await this.invoices.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      relations: { contract: true },
      skip,
      take: limit,
    });

    const items: InvoiceWithQrResponse[] = invoices.map((inv) => this.attachQr(inv));
    return { items, total, page, limit };
  }

  /**
   * Retrieves a single invoice by ID with authorization checks.
   */
  async getInvoiceById(id: string, actor: AuthUser): Promise<InvoiceWithQrResponse> {
    const invoice = await this.invoices.findOne({
      where: { id },
      relations: {
        customer: true,
        contract: { bookingItem: { storageUnit: true } },
      },
    });

    if (!invoice) notFound('Invoice');

    const isCustomer = actor.roles.includes(UserRole.CUSTOMER);
    const isStaffOrAdmin =
      actor.roles.includes(UserRole.ADMIN) ||
      actor.roles.includes(UserRole.FACILITY_MANAGER) ||
      actor.roles.includes(UserRole.FACILITY_STAFF);

    if (isCustomer && invoice.customerId !== actor.id && !isStaffOrAdmin) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have access to this invoice',
        HttpStatus.FORBIDDEN,
      );
    }

    const items = await this.invoiceItems.find({ where: { invoiceId: invoice.id } });
    const response = this.attachQr(invoice);
    response.items = items;
    return response;
  }

  /**
   * Triggers manual re-rendering of an invoice PDF.
   */
  async queuePdfRegeneration(invoiceId: string, actor: AuthUser): Promise<{ queued: boolean }> {
    const invoice = await this.getInvoiceById(invoiceId, actor);
    await this.queueService.send('invoice.render-pdf', { invoiceId: invoice.id });
    return { queued: true };
  }

  private attachQr(invoice: Invoice): InvoiceWithQrResponse {
    const isPayable =
      invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.PARTIALLY_PAID;
    return {
      ...invoice,
      paymentQrUrl: isPayable
        ? buildPaymentQrUrl(this.configService, invoice.total, invoice.invoiceNo)
        : null,
    };
  }
}
