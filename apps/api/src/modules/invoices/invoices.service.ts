import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { buildPaymentQrUrl } from '@modules/payments/vietqr.util';
import { QueueService } from '@modules/queue/queue.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, InvoiceStatus, UserRole } from '@storage/types';
import { DataSource, Repository } from 'typeorm';
import {
  issueRentPeriodInvoice,
  queueInvoicePdf,
  type RentPeriod,
  recurringRentPeriods,
} from './rent-period-invoice.util';

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
      for (const period of recurringRentPeriods(contract)) {
        // Issued from leadDays before the period starts until it ends.
        const issueThreshold = new Date(period.startAt);
        issueThreshold.setDate(issueThreshold.getDate() - leadDays);
        if (now < issueThreshold || now >= period.endAt) continue;
        try {
          const invoice = await this.issuePeriodInvoiceIfAbsent(contract, period, now);
          if (invoice) {
            issuedInvoiceNos.push(invoice.invoiceNo);
            // Send background PDF generation job to pg-boss
            await queueInvoicePdf(this.queueService, invoice.id);
          }
        } catch (err: any) {
          this.logger.error(
            `Error issuing recurring invoice for contract ${contract.contractNo}, period ${period.periodNo}: ${err?.message || err}`,
            err?.stack,
          );
        }
      }
    }

    this.logger.log(
      `Recurring invoice scan finished: ${issuedInvoiceNos.length} new invoices issued`,
    );
    return { issuedCount: issuedInvoiceNos.length, invoiceNos: issuedInvoiceNos };
  }

  /**
   * Issues one rent period unless it exists. The contract row is share-locked and re-checked:
   * the scan read it outside this transaction, and a return finalized meanwhile (which holds
   * the row for update, and issues the periods it still owes itself) must not get a fresh one.
   */
  private async issuePeriodInvoiceIfAbsent(
    contract: Contract,
    period: RentPeriod,
    now: Date,
  ): Promise<Invoice | null> {
    return this.dataSource.transaction(async (em) => {
      const [current]: { status: ContractStatus }[] = await em.query(
        'SELECT status FROM contracts WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
        [contract.id],
      );
      if (current?.status !== ContractStatus.ACTIVE) {
        this.logger.log(
          `Contract ${contract.contractNo} is ${current?.status ?? 'gone'}; period ${period.periodNo} not issued`,
        );
        return null;
      }
      const unit = contract.bookingItem
        ? { id: contract.bookingItem.storageUnitId, code: contract.bookingItem.storageUnit?.code }
        : null;
      const saved = await issueRentPeriodInvoice(
        em,
        contract,
        unit,
        period,
        now,
        this.notificationsService,
      );
      if (saved) {
        this.logger.log(
          `Issued recurring invoice ${saved.invoiceNo} for contract ${contract.contractNo}, period ${period.periodNo}`,
        );
      }
      return saved;
    });
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
