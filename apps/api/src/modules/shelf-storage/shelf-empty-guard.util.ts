import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import type { EntityManager } from 'typeorm';

export type ShelfEmptyReason = 'RETURN' | 'UNIT_CHANGE';

const MESSAGE: Record<ShelfEmptyReason, (count: number) => string> = {
  RETURN: (n) => `Kệ còn ${n} món đồ của khách — ghi phiếu lấy đồ trước khi chốt trả kệ`,
  UNIT_CHANGE: (n) => `Kệ còn ${n} món đồ của khách — trả hết đồ trước khi chuyển sang kho thường`,
};

/**
 * Refuses while the contract still has goods on its shelf. Callers hold the contract row lock,
 * which every receipt also needs, so nothing can be dropped off between this check and the change.
 */
export async function assertShelfEmpty(
  em: EntityManager,
  contractId: string,
  reason: ShelfEmptyReason,
): Promise<void> {
  const rows: { id: string; name: string; quantity: number }[] = await em.query(
    `SELECT "id", "name", "quantity" FROM "shelf_items"
      WHERE "contract_id" = $1 AND "quantity" > 0 ORDER BY "name"`,
    [contractId],
  );
  if (rows.length === 0) return;
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  throw new DomainException(
    ErrorCode.SHELF_NOT_EMPTY,
    MESSAGE[reason](totalQuantity),
    HttpStatus.CONFLICT,
    {
      reason,
      contractId,
      totalQuantity,
      items: rows.map(({ id, name, quantity }) => ({ itemId: id, name, quantity })),
    },
  );
}

/** Closes open pick-up requests on behalf of the system (no `cancelled_by`) once the shelf is returned. */
export async function cancelOpenPickupRequests(
  em: EntityManager,
  contractId: string,
): Promise<void> {
  await em.query(
    `UPDATE "pickup_requests" SET "status" = 'CANCELLED', "cancelled_at" = now(), "updated_at" = now()
      WHERE "contract_id" = $1 AND "status" IN ('PENDING', 'READY')`,
    [contractId],
  );
}
