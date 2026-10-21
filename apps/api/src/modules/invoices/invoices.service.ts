import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { PAYABLE_INVOICE_STATUSES } from '@modules/contracts/first-rent.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { buildPaymentQrUrl } from '@modules/payments/vietqr.util';
import { QueueService } from '@modules/queue/queue.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, InvoiceStatus, PaymentStatus, UserRole } from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, type FindOptionsWhere, Repository } from 'typeorm';
import {
  issueRentPeriodInvoice,
  queueInvoicePdf,
  type RentPeriod,
  recurringRentPeriods,
} from './rent-period-invoice.util';

export interface InvoiceWithQrResponse extends Invoice {
  /** Sum of the succeeded payments, deposit offsets included. */
  paidAmount: number;
  /** What is still to pay; 0 once settled and on an invoice that takes no money (DRAFT, VOID). */
  amountDue: number;
  /** Transfer QR for `amountDue`; null when the invoice takes no money or nothing is due. */
  paymentQrUrl: string | null;
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
    options: { status?: InvoiceStatus; contractId?: string; page?: number; limit?: number } = {},
  ): Promise<{ items: InvoiceWithQrResponse[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Invoice> = { customerId };
    if (options.status) where.status = options.status;
    if (options.contractId) where.contractId = options.contractId;

    const [invoices, total] = await this.invoices.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      relations: { contract: true },
      skip,
      take: limit,
    });

    const paid = await this.paidByInvoice(invoices.map((inv) => inv.id));
    const items = invoices.map((inv) => this.attachQr(inv, paid.get(inv.id)));
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

    const [items, paid] = await Promise.all([
      this.invoiceItems.find({ where: { invoiceId: invoice.id } }),
      this.paidByInvoice([invoice.id]),
    ]);
    const response = this.attachQr(invoice, paid.get(invoice.id));
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

  /** Succeeded payments summed per invoice, in one query. */
  private async paidByInvoice(invoiceIds: string[]): Promise<Map<string, Decimal>> {
    if (invoiceIds.length === 0) return new Map();
    const rows: { invoiceId: string; paid: string }[] = await this.dataSource.query(
      `SELECT invoice_id AS "invoiceId", sum(amount) AS paid FROM payments
        WHERE invoice_id = ANY($1::uuid[]) AND status = $2 GROUP BY invoice_id`,
      [invoiceIds, PaymentStatus.SUCCEEDED],
    );
    return new Map(rows.map((row) => [row.invoiceId, new Decimal(row.paid ?? 0)]));
  }

  /**
   * What is still due and the QR for it. Only an invoice that takes money (ISSUED or
   * PARTIALLY_PAID) has anything due: a DRAFT, PAID or VOID one is 0 with no QR, whatever was
   * paid on it. The QR asks for the rest, so a partly paid or deposit-offset invoice is not overpaid.
   */
  private attachQr(invoice: Invoice, paid: Decimal = new Decimal(0)): InvoiceWithQrResponse {
    const amountDue = PAYABLE_INVOICE_STATUSES.includes(invoice.status)
      ? Decimal.max(new Decimal(invoice.total).minus(paid), 0)
      : new Decimal(0);
    return {
      ...invoice,
      paidAmount: paid.toNumber(),
      amountDue: amountDue.toNumber(),
      paymentQrUrl: amountDue.gt(0)
        ? buildPaymentQrUrl(this.configService, amountDue.toFixed(0), invoice.invoiceNo)
        : null,
    };
  }
}
