import { Contract } from '@entities/contract.entity';
import { ContractRenewal } from '@entities/contract-renewal.entity';
import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { activeRoleHolderIds } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractRenewalStatus, type ContractRenewalView, UserRole } from '@storage/types';
import { DataSource, type EntityManager } from 'typeorm';
import type {
  ApproveContractRenewalDto,
  CreateContractRenewalDto,
  RejectContractRenewalDto,
} from './dto/contract-renewal.dto';
import {
  type RenewalFacts,
  renewalApprovedNotification,
  renewalRejectedNotification,
  renewalRequestedNotification,
} from './renewal-notifications';
import { assertBeforeTermEnd, assertRenewable, lockContractForRenewal } from './renewal-rules.util';
import { RENEWAL_VIEW_RELATIONS, renewalFacts, toRenewalView } from './renewal-view';

/** What the customer is told once a request is decided; null when they decided it themselves. */
type CustomerNotice = ((facts: RenewalFacts) => NotificationPayload) | null;

const conflict = (message: string, details?: Record<string, unknown>): DomainException =>
  new DomainException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, details);

/**
 * Contract renewals keep the contract and its price: an approved request only adds months, so
 * the term end, the monthly invoices and the overstay all move with it. Every write locks the
 * contract first, then the request, the same order on every path.
 */
@Injectable()
export class ContractRenewalsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  async create(dto: CreateContractRenewalDto, actor: AuthUser): Promise<ContractRenewalView> {
    const [minMonths, maxMonths] = await Promise.all([
      this.settings.getBookingMinRentalMonths(),
      this.settings.getBookingMaxRentalMonths(),
    ]);
    if (dto.months < minMonths || dto.months > maxMonths) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        `Số tháng gia hạn phải từ ${minMonths} đến ${maxMonths}`,
        HttpStatus.BAD_REQUEST,
        { field: 'months', min: minMonths, max: maxMonths },
      );
    }
    const now = new Date();
    return this.dataSource.transaction(async (em) => {
      const contract = await lockContractForRenewal(em, dto.contractId);
      if (contract.customerId !== actor.id) notFound('Contract', dto.contractId);
      await assertRenewable(em, contract);
      assertBeforeTermEnd(contract, now);
      const overdue = await findOverdueInvoiceNos(em, actor.id, now);
      if (overdue.length > 0) {
        throw new DomainException(
          ErrorCode.INVOICE_OVERDUE,
          'Bạn còn hóa đơn quá hạn — thanh toán trước khi gia hạn',
          HttpStatus.CONFLICT,
          { invoiceNos: overdue },
        );
      }
      const pending = await em.count(ContractRenewal, {
        where: { contractId: contract.id, status: ContractRenewalStatus.PENDING },
      });
      if (pending > 0) throw conflict('Hợp đồng đã có yêu cầu gia hạn đang chờ duyệt');

      const saved = await em.save(
        ContractRenewal,
        em.create(ContractRenewal, {
          contractId: contract.id,
          customerId: actor.id,
          months: dto.months,
          note: dto.note || null,
        }),
      );
      const renewal = await this.reload(em, saved.id);
      const facilityId = contract.bookingItem.storageUnit.facilityId;
      await this.notifications.createForUsers(
        em,
        await activeRoleHolderIds(em, [UserRole.FACILITY_MANAGER], [facilityId]),
        renewalRequestedNotification(renewalFacts(renewal), actor.fullName),
      );
      return toRenewalView(renewal);
    });
  }

  /** The customer withdraws their own request while it is still pending. */
  async cancel(id: string, actor: AuthUser): Promise<ContractRenewalView> {
    return this.decide(id, async (_em, renewal) => {
      if (renewal.customerId !== actor.id) notFound('Contract renewal', id);
      renewal.status = ContractRenewalStatus.CANCELLED;
      renewal.decidedBy = actor.id;
      return null;
    });
  }

  /**
   * Adds the months to the contract. Allowed after the term end too: the customer asked in time,
   * and the branch deciding late must not turn their rent into overstay penalties.
   */
  async approve(
    id: string,
    dto: ApproveContractRenewalDto,
    actor: AuthUser,
  ): Promise<ContractRenewalView> {
    return this.decide(id, async (em, renewal, contract) => {
      await this.assertManages(em, actor, contract);
      await assertRenewable(em, contract);
      renewal.previousMonths = contract.months;
      renewal.status = ContractRenewalStatus.APPROVED;
      renewal.decidedBy = actor.id;
      renewal.decisionNote = dto.note || null;
      await em.update(Contract, { id: contract.id }, { months: contract.months + renewal.months });
      return renewalApprovedNotification;
    });
  }

  async reject(
    id: string,
    dto: RejectContractRenewalDto,
    actor: AuthUser,
  ): Promise<ContractRenewalView> {
    return this.decide(id, async (em, renewal, contract) => {
      await this.assertManages(em, actor, contract);
      renewal.status = ContractRenewalStatus.REJECTED;
      renewal.decidedBy = actor.id;
      renewal.decisionNote = dto.reason;
      return (facts) => renewalRejectedNotification(facts, dto.reason);
    });
  }

  /**
   * Closes a PENDING request: locks contract then request, lets `apply` set the outcome, saves it
   * and tells the customer when `apply` returns a notification builder.
   */
  private async decide(
    id: string,
    apply: (
      em: EntityManager,
      renewal: ContractRenewal,
      contract: Contract,
    ) => Promise<CustomerNotice>,
  ): Promise<ContractRenewalView> {
    return this.dataSource.transaction(async (em) => {
      const peek = await em.findOne(ContractRenewal, { where: { id } });
      if (!peek) notFound('Contract renewal', id);
      const contract = await lockContractForRenewal(em, peek.contractId);
      const renewal = await em.findOne(ContractRenewal, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!renewal) notFound('Contract renewal', id);
      if (renewal.status !== ContractRenewalStatus.PENDING) {
        throw conflict('Yêu cầu gia hạn đã được xử lý', { status: renewal.status });
      }
      const notify = await apply(em, renewal, contract);
      renewal.decidedAt = new Date();
      await em.save(ContractRenewal, renewal);
      const decided = await this.reload(em, id);
      if (notify) {
        await this.notifications.createForUsers(
          em,
          [decided.customerId],
          notify(renewalFacts(decided)),
        );
      }
      return toRenewalView(decided);
    });
  }

  private reload(em: EntityManager, id: string): Promise<ContractRenewal> {
    return em.findOneOrFail(ContractRenewal, { where: { id }, relations: RENEWAL_VIEW_RELATIONS });
  }

  private async assertManages(em: EntityManager, actor: AuthUser, contract: Contract) {
    if (await managesFacility(em, actor, contract.bookingItem.storageUnit.facilityId)) return;
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You do not manage the facility this contract belongs to',
      HttpStatus.FORBIDDEN,
    );
  }
}
