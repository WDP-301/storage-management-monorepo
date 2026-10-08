import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, InspectionType } from '@storage/types';
import { DataSource, IsNull } from 'typeorm';
import { ReturnRequestDto } from './dto/return-request.dto';

@Injectable()
export class ContractReturnService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Customer asks to move out: opens a RETURN inspection for staff to carry out on the
   * requested date. The contract row lock serializes double taps, so at most one open
   * return exists per contract.
   */
  async requestReturn(
    contractId: string,
    customerId: string,
    dto: ReturnRequestDto,
  ): Promise<Inspection> {
    return this.dataSource.transaction(async (em) => {
      const contract = await em.findOne(Contract, {
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      // Someone else's contract is reported as missing rather than forbidden.
      if (!contract || contract.customerId !== customerId) notFound('Contract', contractId);
      if (contract.status !== ContractStatus.ACTIVE) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Only an active contract can be returned',
          HttpStatus.CONFLICT,
          { contractId, status: contract.status, requiredStatus: ContractStatus.ACTIVE },
        );
      }
      const open = await em.findOne(Inspection, {
        where: { contractId, type: InspectionType.RETURN, finalizedAt: IsNull() },
      });
      if (open) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'A return request is already open for this contract',
          HttpStatus.CONFLICT,
          { contractId, inspectionId: open.id },
        );
      }
      return em.save(
        Inspection,
        em.create(Inspection, {
          contractId,
          type: InspectionType.RETURN,
          scheduledAt: new Date(dto.scheduledAt),
          conditionNotes: dto.note?.trim() || undefined,
        }),
      );
    });
  }
}
