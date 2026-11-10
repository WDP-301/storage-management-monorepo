import { randomUUID } from 'node:crypto';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { contractCancelledNotification } from '@modules/settlements/settlement-notifications';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  ContractStatus,
  InvoiceStatus,
  PaymentStatus,
  type SettlementLine,
  SettlementLineType,
  SettlementStatus,
  StorageUnitStatus,
} from '@storage/types';
import { DataSource, type EntityManager, In, IsNull } from 'typeorm';
import { resolveContractDeposit } from './deposit-ledger.util';

@Injectable()
export class ContractCancelService {
  private readonly logger = new Logger(ContractCancelService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Drops a DRAFT contract the customer never collected (no-show, withdrawn deposit): the
   * contract becomes CANCELLED and its unit goes back on the market. Only a DRAFT can be
   * cancelled — once handover is signed the contract ends through a return inspection.
   */
  async cancelDraft(contractId: string, actor: AuthUser): Promise<Contract> {
    return this.dataSource.transaction(async (em) => {
      const contract = await em.findOne(Contract, {
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', contractId);

      const item = await em.findOneOrFail(BookingItem, {
        where: { id: contract.bookingItemId },
        relations: { storageUnit: true },
      });
      await this.assertManagesFacility(em, actor, item.storageUnit.facilityId);

      if (contract.status !== ContractStatus.DRAFT) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Only a DRAFT contract can be cancelled',
          HttpStatus.CONFLICT,
          { contractId, status: contract.status, requiredStatus: ContractStatus.DRAFT },
        );
      }

      const now = new Date();
      // What the customer already paid, before the status flips: the deposit ledger (a resolved
      // deposit is recorded here so the settlement has a row to point at) and any invoice
      // payments taken for the first month.
      const deposit = await resolveContractDeposit(em, contract, { create: true });
      const paid: { payment_id: string; amount: number; invoice_id: string; invoice_no: string }[] =
        await em.query(
          `SELECT p.id AS payment_id, p.amount::float8 AS amount,
                  i.id AS invoice_id, i.invoice_no
             FROM payments p JOIN invoices i ON i.id = p.invoice_id
            WHERE i.contract_id = $1 AND p.status = $2
            ORDER BY p.created_at`,
          [contract.id, PaymentStatus.SUCCEEDED],
        );

      await em.update(Contract, { id: contract.id }, { status: ContractStatus.CANCELLED });
      await em.update(
        StorageUnit,
        { id: item.storageUnitId, status: In([StorageUnitStatus.BOOKED, StorageUnitStatus.HELD]) },
        { status: StorageUnitStatus.AVAILABLE },
      );
      // An unpaid first-month invoice is void.
      await em.update(
        Invoice,
        { contractId: contract.id, status: InvoiceStatus.ISSUED },
        { status: InvoiceStatus.VOID },
      );

      // Money already taken is queued for a manual refund: an approved settlement that refunds
      // the deposit plus whatever invoice payments were made, confirmed through the usual
      // refund-complete flow (evidence + transfer reference).
      const credits: SettlementLine[] = paid.map((row) => ({
        type: SettlementLineType.UNUSED_PERIOD_CREDIT,
        direction: 'CREDIT',
        description: `Hoàn tiền đã thu trên hóa đơn ${row.invoice_no} — hủy trước bàn giao`,
        quantity: 1,
        unit_amount: row.amount,
        amount: row.amount,
        waived: false,
        waive_reason: null,
        needs_decision: false,
        invoice_id: row.invoice_id,
        invoice_no: row.invoice_no,
        payment_id: row.payment_id,
      }));
      const depositAmount = Number(deposit?.amount ?? 0);
      const creditsTotal = credits.reduce((sum, line) => sum + line.amount, 0);
      const refundAmount = depositAmount + creditsTotal;

      let settlementId: string | null = null;
      if (deposit && refundAmount > 0) {
        settlementId = randomUUID();
        await em.insert(ContractSettlement, {
          id: settlementId,
          contractId: contract.id,
          depositId: deposit.id,
          status: SettlementStatus.AWAITING_REFUND,
          lines: credits,
          depositAmount,
          creditsTotal,
          deductionsTotal: 0,
          refundAmount,
          shortfallAmount: 0,
          note: 'Hủy hợp đồng trước bàn giao — hoàn lại toàn bộ tiền đã thu',
          approvedBy: actor.id,
          approvedAt: now,
        });
      } else if (refundAmount > 0) {
        this.logger.warn(
          `Contract ${contract.id} cancelled with ${refundAmount} captured but no resolvable deposit — manual refund needed`,
        );
      }

      await this.notifications.createForUsers(
        em,
        [contract.customerId],
        contractCancelledNotification(contract, settlementId, refundAmount),
      );
      this.logger.log(`Contract ${contract.contractNo} cancelled by ${actor.id}`);
      return { ...contract, status: ContractStatus.CANCELLED };
    });
  }

  private async assertManagesFacility(
    em: EntityManager,
    actor: AuthUser,
    facilityId: string,
  ): Promise<void> {
    if (await managesFacility(em, actor, facilityId)) return;
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not manage the facility this contract belongs to',
      HttpStatus.FORBIDDEN,
    );
  }
}
