import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { BanksService } from '@modules/banks/banks.service';
import { forContractOwner } from '@modules/inspection/inspection-access.util';
import { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { InspectionType, ReturnRequestSource } from '@storage/types';
import { DataSource, type EntityManager, IsNull } from 'typeorm';
import {
  assertContractActive,
  assertReturnDayInRange,
  currentReturnRules,
  moveReturn,
  openReturnInspection,
  RETURN_MESSAGES,
  returnConflict,
} from './contract-return.util';
import { ReturnRequestDto, UpdateReturnRequestDto } from './dto/return-request.dto';
import { rememberRefundAccount } from './refund-account.util';

/** Staff wrote something on the return, so it is now part of the inspection record. */
const staffStarted = (inspection: Inspection): boolean =>
  (inspection.evidence?.length ?? 0) > 0 ||
  (inspection.damages?.length ?? 0) > 0 ||
  Boolean(inspection.conditionNotes?.trim()) ||
  inspection.inspectedAt != null;

/** The customer's own return request: create, change and withdraw it. */
@Injectable()
export class ContractReturnService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly banks: BanksService,
  ) {}

  /** Opens a RETURN inspection on the requested day; the refund account is optional. */
  async requestReturn(
    contractId: string,
    customerId: string,
    dto: ReturnRequestDto,
  ): Promise<Inspection> {
    const now = new Date();
    const scheduledAt = new Date(dto.scheduledAt);
    assertReturnDayInRange('scheduledAt', scheduledAt, now);
    const rules = await currentReturnRules(this.settings);
    // Looked up before any lock is taken: the bank call can take seconds.
    const refundAccount = dto.refundAccount
      ? await this.banks.verifyAccount(dto.refundAccount)
      : null;

    const created = await this.dataSource.transaction(async (em) => {
      // The contract lock serializes double taps: at most one open return per contract.
      const contract = await em.findOne(Contract, {
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract || contract.customerId !== customerId) notFound('Contract', contractId);
      const inspection = await openReturnInspection(em, contract, {
        scheduledAt,
        note: dto.note,
        refundAccount,
        rules,
        requestedBy: customerId,
        source: ReturnRequestSource.CUSTOMER,
        now,
      });
      if (refundAccount) await rememberRefundAccount(em, customerId, refundAccount);
      return inspection;
    });
    return forContractOwner(created);
  }

  /**
   * Changes the day, note or refund account of the open return. Only the return row is locked,
   * never the contract, so this cannot deadlock with a finalize (inspection → contract).
   */
  async updateReturn(
    contractId: string,
    customerId: string,
    dto: UpdateReturnRequestDto,
  ): Promise<Inspection> {
    const now = new Date();
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    // Looked up before any lock is taken: the bank call can take seconds.
    const refundAccount = dto.refundAccount
      ? await this.banks.verifyAccount(dto.refundAccount)
      : null;

    const saved = await this.dataSource.transaction(async (em) => {
      const inspection = await this.lockOpenReturn(em, contractId, customerId);
      if (scheduledAt) moveReturn(inspection, scheduledAt, now);
      if (dto.note !== undefined) inspection.requestNote = dto.note.trim() || null;
      if (refundAccount) {
        inspection.refundAccount = refundAccount;
        await rememberRefundAccount(em, customerId, refundAccount);
      }
      return em.save(Inspection, inspection);
    });
    return forContractOwner(saved);
  }

  /**
   * Withdraws the open return while staff have recorded nothing on it. The row is deleted:
   * a return has no status of its own, and nothing but its damage fees refers to it.
   */
  async cancelReturn(contractId: string, customerId: string): Promise<{ id: string }> {
    return this.dataSource.transaction(async (em) => {
      const inspection = await this.lockOpenReturn(em, contractId, customerId);
      if (staffStarted(inspection)) {
        throw returnConflict(
          RETURN_MESSAGES.locked,
          { contractId, inspectionId: inspection.id },
          ErrorCode.RETURN_REQUEST_LOCKED,
        );
      }
      await em.delete(Inspection, { id: inspection.id });
      return { id: inspection.id };
    });
  }

  /**
   * The customer's latest return, row-locked. 404 for someone else's contract or when no
   * return was requested; 409 RETURN_REQUEST_LOCKED once it is finalized (for a change and a
   * withdrawal alike — the record, refund account included, is frozen), 409 CONFLICT when the
   * contract is no longer active.
   */
  private async lockOpenReturn(
    em: EntityManager,
    contractId: string,
    customerId: string,
  ): Promise<Inspection> {
    const contract = await em.findOne(Contract, { where: { id: contractId, deletedAt: IsNull() } });
    if (!contract || contract.customerId !== customerId) notFound('Contract', contractId);
    const inspection = await em.findOne(Inspection, {
      where: { contractId, type: InspectionType.RETURN },
      order: { createdAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!inspection) throw returnNotFound(contractId);
    if (inspection.finalizedAt) {
      throw returnConflict(
        RETURN_MESSAGES.finalized,
        {
          contractId,
          inspectionId: inspection.id,
          finalizedAt: inspection.finalizedAt.toISOString(),
        },
        ErrorCode.RETURN_REQUEST_LOCKED,
      );
    }
    assertContractActive(contract);
    return inspection;
  }
}

function returnNotFound(contractId: string): DomainException {
  return new DomainException(
    ErrorCode.RESOURCE_NOT_FOUND,
    RETURN_MESSAGES.notFound,
    HttpStatus.NOT_FOUND,
    { contractId },
  );
}
