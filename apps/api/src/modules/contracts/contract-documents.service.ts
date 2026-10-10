import { Contract, type ContractDocument } from '@entities/contract.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus } from '@storage/types';
import { DataSource, IsNull } from 'typeorm';
import { resolveContractAccess } from './contract-access.util';
import type { ContractDocumentDto } from './dto/contract-documents.dto';

export const CONTRACT_DOCUMENTS_REQUIRED_MESSAGE =
  'Chưa có file hợp đồng đã ký — tải lên trước khi chốt biên nhận.';

export interface ContractDocumentsResult {
  id: string;
  status: ContractStatus;
  documents: ContractDocument[];
}

@Injectable()
export class ContractDocumentsService {
  private readonly logger = new Logger(ContractDocumentsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Replaces the contract's signed files. Check order matters: 404, then 403 (so a stranger
   * never learns the contract's state), then 409 for closed contracts, then 409 when an
   * ACTIVE contract would be left without files. The contract row stays locked so a
   * concurrent handover finalize sees the files this call leaves behind.
   */
  async replace(
    contractId: string,
    files: ContractDocumentDto[],
    actor: AuthUser,
  ): Promise<ContractDocumentsResult> {
    return this.dataSource.transaction(async (em) => {
      const contract = await em.findOne(Contract, {
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', contractId);

      const access = await resolveContractAccess(em, contract, actor);
      if (!access.isManager && !access.permissions.documents) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You cannot change the files of this contract',
          HttpStatus.FORBIDDEN,
        );
      }
      if (
        contract.status === ContractStatus.ENDED ||
        contract.status === ContractStatus.CANCELLED
      ) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Files of a ${contract.status} contract cannot be changed`,
          HttpStatus.CONFLICT,
          { contractId, status: contract.status },
        );
      }
      if (contract.status === ContractStatus.ACTIVE && files.length === 0) {
        throw new DomainException(
          ErrorCode.CONTRACT_DOCUMENTS_REQUIRED,
          'An active contract must keep at least one signed file',
          HttpStatus.CONFLICT,
          { contractId },
        );
      }

      const documents: ContractDocument[] = files.map(({ fileKey, name, mimeType, size }) => ({
        fileKey,
        name,
        mimeType,
        ...(size === undefined ? {} : { size }),
      }));
      await em.update(Contract, { id: contract.id }, { documents });
      this.logger.log(
        `Contract ${contract.contractNo} files set to ${documents.length} by ${actor.id}`,
      );
      return { id: contract.id, status: contract.status, documents };
    });
  }
}
