import { Inspection } from '@entities/inspection.entity';
import { InspectionType } from '@storage/types';
import { type DataSource, In } from 'typeorm';

export type ContractInspections = { handover?: Inspection; return?: Inspection };

/** Handover and the latest return of each contract, keyed by contract id. */
export async function loadContractInspections(
  dataSource: DataSource,
  contractIds: string[],
): Promise<Map<string, ContractInspections>> {
  const byContract = new Map<string, ContractInspections>();
  if (contractIds.length === 0) return byContract;
  // Oldest first, so the latest RETURN wins when several exist for one contract.
  const inspections = await dataSource.getRepository(Inspection).find({
    where: {
      contractId: In(contractIds),
      type: In([InspectionType.PRE_HANDOVER, InspectionType.RETURN]),
    },
    relations: { inspector: true },
    order: { createdAt: 'ASC' },
  });
  for (const inspection of inspections) {
    const entry = byContract.get(inspection.contractId) ?? {};
    if (inspection.type === InspectionType.PRE_HANDOVER) entry.handover = inspection;
    else entry.return = inspection;
    byContract.set(inspection.contractId, entry);
  }
  return byContract;
}
