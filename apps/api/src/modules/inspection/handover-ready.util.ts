import type { Contract } from '@entities/contract.entity';
import type { Invoice } from '@entities/invoice.entity';
import { CONTRACT_DOCUMENTS_REQUIRED_MESSAGE } from '@modules/contracts/contract-documents.service';
import {
  FIRST_RENT_UNPAID_MESSAGE,
  findFirstRentInvoice,
} from '@modules/contracts/first-rent.util';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { InvoiceStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';

/** Handover needs the signed contract files and the first month's rent paid. */
export async function assertReadyForHandover(
  em: EntityManager,
  contract: Contract,
): Promise<Invoice> {
  if (!contract.documents?.length) {
    throw new DomainException(
      ErrorCode.CONTRACT_DOCUMENTS_REQUIRED,
      CONTRACT_DOCUMENTS_REQUIRED_MESSAGE,
      HttpStatus.CONFLICT,
      { contractId: contract.id },
    );
  }
  // Locked so a concurrent void or payment cannot change it under the handover.
  const invoice = await findFirstRentInvoice(em, contract.id, { lock: true });
  if (invoice?.status !== InvoiceStatus.PAID) {
    throw new DomainException(
      ErrorCode.FIRST_RENT_UNPAID,
      FIRST_RENT_UNPAID_MESSAGE,
      HttpStatus.CONFLICT,
      { contractId: contract.id, invoiceStatus: invoice?.status ?? null },
    );
  }
  return invoice;
}
