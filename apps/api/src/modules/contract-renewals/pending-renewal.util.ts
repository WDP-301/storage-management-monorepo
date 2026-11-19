import { ContractRenewal } from '@entities/contract-renewal.entity';
import { ContractRenewalStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';

export async function hasPendingRenewal(em: EntityManager, contractId: string): Promise<boolean> {
  return (
    (await em.count(ContractRenewal, {
      where: { contractId, status: ContractRenewalStatus.PENDING },
    })) > 0
  );
}

/**
 * A contract on its way out drops the extension it asked for: its pending renewal is closed as
 * withdrawn, so it neither lingers in the branch's queue nor keeps term-end reminders silent.
 */
export async function closePendingRenewal(
  em: EntityManager,
  contractId: string,
  actorId: string | null,
  reason: string,
): Promise<void> {
  await em.update(
    ContractRenewal,
    { contractId, status: ContractRenewalStatus.PENDING },
    {
      status: ContractRenewalStatus.CANCELLED,
      decidedAt: new Date(),
      decidedBy: actorId,
      decisionNote: reason,
    },
  );
}
