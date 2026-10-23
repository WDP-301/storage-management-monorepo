import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { Payment } from '@entities/payment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { invoiceIssuedNotification } from '@modules/invoices/rent-period-invoice.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { generateInvoiceNo } from '@modules/payments/invoice-no.util';
import { generatePaymentNo } from '@modules/payments/payment-no.util';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  ContractStatus,
  InvoiceItemType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  RentalPeriodKind,
} from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, type EntityManager, IsNull } from 'typeorm';
import { resolveContractAccess } from './contract-access.util';
import {
  FIRST_RENT_PERIOD_NO,
  type FirstRentSummary,
  findFirstRentInvoice,
  loadFirstRentSummaries,
  PAYABLE_INVOICE_STATUSES,
  sumInvoicePayments,
  withPaymentQr,
} from './first-rent.util';

/**
 * The first month's rent, collected at check-in before the handover can be signed off.
 * Staff issue an invoice whose QR carries the invoice number; the SePay webhook settles it
 * (FirstRentPaymentListener), or staff confirm cash. Either way the money lands in
 * `payments` against that invoice.
 */
@Injectable()
export class FirstRentService {
  private readonly logger = new Logger(FirstRentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Issues the first-month invoice, or returns the one already issued (repeat taps are safe). */
  async issue(contractId: string, actor: AuthUser): Promise<FirstRentSummary> {
    await this.dataSource.transaction(async (em) => {
      const contract = await this.lockCollectableContract(em, contractId, actor);
      if (await findFirstRentInvoice(em, contract.id)) return;

      const item = await em.findOneOrFail(BookingItem, {
        where: { id: contract.bookingItemId },
        relations: { storageUnit: true },
      });
      const amount = new Decimal(contract.monthlyPriceSnapshot);
      const now = new Date();
      const invoice = await em.save(
        Invoice,
        em.create(Invoice, {
          invoiceNo: generateInvoiceNo(),
          customerId: contract.customerId,
          contractId: contract.id,
          kind: RentalPeriodKind.INITIAL,
          periodNo: FIRST_RENT_PERIOD_NO,
          months: 1,
          monthlyPriceSnapshot: contract.monthlyPriceSnapshot,
          // Nothing to collect on a free unit: it is settled from the start.
          status: amount.gt(0) ? InvoiceStatus.ISSUED : InvoiceStatus.PAID,
          subtotal: amount.toNumber(),
          taxAmount: 0,
          total: amount.toNumber(),
          issuedAt: now,
          dueAt: now,
        }),
      );
      await em.save(
        InvoiceItem,
        em.create(InvoiceItem, {
          invoiceId: invoice.id,
          storageUnitId: item.storageUnitId,
          itemType: InvoiceItemType.RENT,
          description: `Tiền thuê tháng 1 — kho ${item.storageUnit?.code ?? ''}`.trim(),
          quantity: 1,
          unitAmount: amount.toNumber(),
          amount: amount.toNumber(),
        }),
      );
      // The customer pays from their own phone: the notification opens the contract and its QR.
      if (invoice.status === InvoiceStatus.ISSUED) {
        await this.notifications.createForUsers(
          em,
          [contract.customerId],
          invoiceIssuedNotification(invoice),
        );
      }
      this.logger.log(
        `First rent ${invoice.invoiceNo} issued for contract ${contract.contractNo} by ${actor.id}`,
      );
    });
    return this.summary(contractId);
  }

  /** Staff took the amount still due in cash: record it and settle the invoice. */
  async confirmCash(contractId: string, actor: AuthUser): Promise<FirstRentSummary> {
    await this.dataSource.transaction(async (em) => {
      const contract = await this.lockCollectableContract(em, contractId, actor);
      const invoice = await findFirstRentInvoice(em, contract.id, { lock: true });
      if (!invoice) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Tạo hóa đơn tháng đầu trước khi xác nhận tiền mặt.',
          HttpStatus.CONFLICT,
          { contractId },
        );
      }
      // A transfer may have landed meanwhile: nothing left to confirm.
      if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) return;

      const due = new Decimal(invoice.total).minus(await sumInvoicePayments(em, invoice.id));
      if (due.gt(0)) {
        await em.save(Payment, {
          paymentNo: generatePaymentNo(),
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          type: PaymentType.RENT,
          method: PaymentMethod.CASH,
          status: PaymentStatus.SUCCEEDED,
          amount: due.toNumber(),
          paidAt: new Date(),
          metadata: { confirmedBy: actor.id },
        });
      }
      await em.update(Invoice, { id: invoice.id }, { status: InvoiceStatus.PAID });
      this.logger.log(
        `First rent ${invoice.invoiceNo} settled in cash (${due.toFixed(0)}) by ${actor.id}`,
      );
    });
    return this.summary(contractId);
  }

  /** Summary with the transfer QR for whatever is still due. */
  async summary(contractId: string): Promise<FirstRentSummary> {
    const summary = (await loadFirstRentSummaries(this.dataSource, [contractId])).get(contractId);
    if (!summary) notFound('First rent invoice', contractId);
    return withPaymentQr(summary, this.config);
  }

  /**
   * Locks a contract whose first rent the actor may collect. Check order follows the
   * documents write: 404, then 403 (a stranger never learns the state), then 409.
   */
  private async lockCollectableContract(
    em: EntityManager,
    contractId: string,
    actor: AuthUser,
  ): Promise<Contract> {
    const contract = await em.findOne(Contract, {
      where: { id: contractId, deletedAt: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!contract) notFound('Contract', contractId);
    const access = await resolveContractAccess(em, contract, actor);
    if (!access.canView) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You are not assigned to this contract',
        HttpStatus.FORBIDDEN,
      );
    }
    if (contract.status !== ContractStatus.DRAFT) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'The first month is only collected before handover',
        HttpStatus.CONFLICT,
        { contractId, status: contract.status, requiredStatus: ContractStatus.DRAFT },
      );
    }
    if (!access.permissions.first_rent) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Only the assigned handover inspector or a manager can collect the first month',
        HttpStatus.FORBIDDEN,
      );
    }
    return contract;
  }
}
