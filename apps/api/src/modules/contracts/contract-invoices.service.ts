import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { generatePaymentNo } from '@modules/payments/payment-no.util';
import { normalizedRefSql, normalizeTransferRef } from '@modules/payments/transfer-ref.util';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  type ContractInvoiceRecord,
  ContractStatus,
  InvoiceKind,
  InvoiceStatus,
  ManualPaymentMethod,
  PaymentStatus,
  PaymentType,
  type RecordInvoicePaymentInput,
} from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, type EntityManager, In, IsNull, Not } from 'typeorm';
import {
  type ManualPaymentMetadata,
  toContractInvoiceRecord,
  toInvoicePaymentRecord,
} from './contract-invoice.records';
import { PAYABLE_INVOICE_STATUSES, sumInvoicePayments } from './first-rent.util';
import { invoicePaidNotification } from './invoice-notifications';

/** Clock skew tolerated between the browser and the server for "received just now". */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Invoices of a contract for the back office, and recording money that SePay could not match
 * (cash, or a transfer without the invoice number in its content). Operations managers and
 * admins work every contract; facility managers only those of facilities they manage.
 */
@Injectable()
export class ContractInvoicesService {
  private readonly logger = new Logger(ContractInvoicesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async list(contractId: string, actor: AuthUser): Promise<ContractInvoiceRecord[]> {
    const em = this.dataSource.manager;
    await this.assertManagesContract(em, contractId, actor);
    const invoices = await em.find(Invoice, {
      where: { contractId, status: Not(InvoiceStatus.DRAFT) },
      order: { periodNo: 'ASC', createdAt: 'ASC' },
    });
    return this.toRecords(em, invoices);
  }

  /**
   * Applies a hand-recorded payment. The invoice row is locked so the amount due is computed on
   * committed payments — a SePay transfer landing at the same time cannot double-settle it.
   */
  async recordPayment(
    contractId: string,
    invoiceId: string,
    dto: RecordInvoicePaymentInput,
    actor: AuthUser,
  ): Promise<ContractInvoiceRecord> {
    const transferRef = dto.transferRef ? normalizeTransferRef(dto.transferRef) || null : null;
    const evidence = dto.evidence ?? [];
    if (dto.method === ManualPaymentMethod.BANK_TRANSFER && !transferRef && evidence.length === 0) {
      throw fieldValidationError(
        'transferRef',
        'proofRequired',
        'Nhập mã giao dịch hoặc đính kèm ảnh giao dịch chuyển khoản',
      );
    }
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      throw fieldValidationError('paidAt', 'future', 'Ngày nhận tiền không được ở tương lai');
    }

    const invoice = await this.dataSource.transaction(async (em) => {
      const contract = await this.assertManagesContract(em, contractId, actor);
      // Cancelling a draft keeps a part-paid first month for the refund; it takes no more money.
      if (contract.status === ContractStatus.CANCELLED) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Hợp đồng đã hủy — không ghi nhận thêm thanh toán',
          HttpStatus.CONFLICT,
          { contractId, status: contract.status },
        );
      }
      const locked = await em.findOne(Invoice, {
        where: { id: invoiceId, contractId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) notFound('Invoice', invoiceId);
      if (!PAYABLE_INVOICE_STATUSES.includes(locked.status)) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Hóa đơn này không còn nhận thanh toán',
          HttpStatus.CONFLICT,
          { invoiceId, status: locked.status },
        );
      }

      const paid = await sumInvoicePayments(em, locked.id);
      // Amounts are whole VND while totals may carry cents: the last payment may round the
      // remainder up, so a total like 300.000,50 can still be settled.
      const due = new Decimal(locked.total).minus(paid).ceil();
      if (new Decimal(dto.amount).gt(due)) {
        throw fieldValidationError(
          'amount',
          'exceedsDue',
          `Số tiền vượt quá số còn phải thu (${due.toFixed(0)} VND)`,
        );
      }
      if (transferRef && (await this.isTransferRefUsed(em, transferRef))) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Mã giao dịch này đã được ghi nhận cho một khoản thanh toán khác',
          HttpStatus.CONFLICT,
          { transferRef },
        );
      }

      const metadata: ManualPaymentMetadata = {
        confirmedBy: actor.id,
        note: dto.note.trim(),
        ...(transferRef ? { transferRef } : {}),
        ...(evidence.length > 0 ? { evidence } : {}),
      };
      await em.save(Payment, {
        paymentNo: generatePaymentNo(),
        invoiceId: locked.id,
        customerId: locked.customerId,
        type: locked.kind === InvoiceKind.SETTLEMENT ? PaymentType.FEE : PaymentType.RENT,
        method: dto.method,
        status: PaymentStatus.SUCCEEDED,
        amount: dto.amount,
        paidAt,
        metadata,
      });

      const status = paid.plus(dto.amount).gte(locked.total)
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;
      await em.update(Invoice, { id: locked.id }, { status });
      if (status === InvoiceStatus.PAID) {
        await this.notifications.createForUsers(
          em,
          [locked.customerId],
          invoicePaidNotification(locked, dto.amount),
        );
      }
      this.logger.log(
        `Manual ${dto.method} ${dto.amount} on ${locked.invoiceNo} by ${actor.id}: ${status}`,
      );
      return { ...locked, status };
    });

    const [record] = await this.toRecords(this.dataSource.manager, [invoice]);
    return record;
  }

  /** 404 for a missing contract, 403 when the actor does not manage its facility. */
  private async assertManagesContract(
    em: EntityManager,
    contractId: string,
    actor: AuthUser,
  ): Promise<Contract> {
    const contract = await em.findOne(Contract, {
      where: { id: contractId, deletedAt: IsNull() },
      relations: { bookingItem: { storageUnit: true } },
    });
    if (!contract) notFound('Contract', contractId);
    const facilityId = contract.bookingItem?.storageUnit?.facilityId ?? null;
    if (!(await managesFacility(em, actor, facilityId))) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage the facility of this contract',
        HttpStatus.FORBIDDEN,
      );
    }
    return contract;
  }

  /**
   * A bank reference is either typed on a manual payment or carried by a SePay-matched transfer
   * (`referenceCode`, not SePay's own id in `provider_ref`). `transferRef` is already normalized.
   * The transaction-scoped advisory lock serializes two people recording the same reference.
   */
  private async isTransferRefUsed(em: EntityManager, transferRef: string): Promise<boolean> {
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`payment-ref:${transferRef}`]);
    const rows: unknown[] = await em.query(
      `SELECT 1 FROM payments
        WHERE ${normalizedRefSql("metadata->>'transferRef'")} = $1
           OR ${normalizedRefSql("metadata->>'referenceCode'")} = $1
        LIMIT 1`,
      [transferRef],
    );
    return rows.length > 0;
  }

  private async toRecords(
    em: EntityManager,
    invoices: Invoice[],
  ): Promise<ContractInvoiceRecord[]> {
    if (invoices.length === 0) return [];
    const payments = await em.find(Payment, {
      where: { invoiceId: In(invoices.map((i) => i.id)), status: PaymentStatus.SUCCEEDED },
      order: { paidAt: 'ASC', createdAt: 'ASC' },
    });
    const userIds = [
      ...new Set(
        payments
          .map((payment) => payment.metadata?.confirmedBy)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const users = userIds.length > 0 ? await em.find(AppUser, { where: { id: In(userIds) } }) : [];
    const names = new Map(users.map((user) => [user.id, user.fullName ?? null]));
    const now = new Date();
    return invoices.map((invoice) =>
      toContractInvoiceRecord(
        invoice,
        payments
          .filter((payment) => payment.invoiceId === invoice.id)
          .map((payment) => toInvoicePaymentRecord(payment, names)),
        now,
      ),
    );
  }
}
