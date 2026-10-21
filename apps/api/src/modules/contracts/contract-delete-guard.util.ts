import type { Contract } from '@entities/contract.entity';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, DepositStatus, InvoiceStatus, SettlementStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';

interface OpenMoney {
  settlement_status: SettlementStatus | null;
  open_invoices: boolean;
  held_deposit: boolean;
}

const refuse = (reason: string, message: string, contractId: string) =>
  new DomainException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, { contractId, reason });

/**
 * A finished contract may only be removed once no money is open on it: an ENDED contract must
 * have its deposit settlement completed, no invoice may still be awaiting payment, and a
 * CANCELLED contract must not still hold a deposit. 409 otherwise.
 */
export async function assertContractDeletable(
  em: EntityManager,
  contract: Pick<Contract, 'id' | 'status'>,
): Promise<void> {
  const [row]: OpenMoney[] = await em.query(
    `SELECT (SELECT s.status FROM contract_settlements s WHERE s.contract_id = $1) AS settlement_status,
            EXISTS (SELECT 1 FROM invoices i WHERE i.contract_id = $1 AND i.status = ANY($2::text[]))
              AS open_invoices,
            EXISTS (SELECT 1 FROM deposits d WHERE d.contract_id = $1 AND d.status = $3)
              AS held_deposit`,
    [contract.id, [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID], DepositStatus.HELD],
  );
  if (
    contract.status === ContractStatus.ENDED &&
    row?.settlement_status !== SettlementStatus.COMPLETED
  ) {
    throw refuse(
      'SETTLEMENT_OPEN',
      'Hợp đồng đã kết thúc nhưng chưa hoàn tất quyết toán cọc — không thể xoá',
      contract.id,
    );
  }
  if (row?.open_invoices) {
    throw refuse(
      'INVOICES_OPEN',
      'Hợp đồng còn hoá đơn chưa thanh toán — không thể xoá',
      contract.id,
    );
  }
  if (contract.status === ContractStatus.CANCELLED && row?.held_deposit) {
    throw refuse(
      'DEPOSIT_HELD',
      'Hợp đồng đã huỷ còn tiền cọc đang giữ — xử lý tiền cọc trước khi xoá',
      contract.id,
    );
  }
}
