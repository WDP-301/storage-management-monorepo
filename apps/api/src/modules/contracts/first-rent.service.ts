import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { generatePaymentNo } from '@modules/payments/payment-no.util';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  ContractStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, type EntityManager, IsNull } from 'typeorm';
import { resolveContractAccess } from './contract-access.util';
import {
  type FirstRentSummary,
  findFirstRentInvoice,
  loadFirstRentSummaries,
  PAYABLE_INVOICE_STATUSES,
  sumInvoicePayments,
  withPaymentQr,
} from './first-rent.util';
import { issueFirstRentInvoice } from './first-rent-issue.util';
import { activateShelfContractSafely } from './shelf-contract.util';

/**
 * The first month's rent, collected at check-in before the handover can be signed off (a shelf
 * has no handover: its invoice is issued when the deposit confirms the booking, and paying it
 * may activate the contract). Staff issue an invoice whose QR carries the invoice number; the
 * SePay webhook settles it (FirstRentPaymentListener), or staff confirm cash. Either way the
 * money lands in `payments` against that invoice.
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
      const invoice = await issueFirstRentInvoice(em, contract, this.notifications);
      if (invoice) {
        this.logger.log(
          `First rent ${invoice.invoiceNo} issued for contract ${contract.contractNo} by ${actor.id}`,
        );
      }
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
      await activateShelfContractSafely(em, contract.id, this.notifications, this.logger);
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
        'Only the handover inspector, the shelf counter staff or a manager can collect the first month',
        HttpStatus.FORBIDDEN,
      );
    }
    return contract;
  }
}
