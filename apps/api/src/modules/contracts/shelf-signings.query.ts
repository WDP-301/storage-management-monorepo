import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  isGlobalManager,
  loadManagedFacilityIds,
} from '@modules/inspection/inspection-access.util';
import {
  ContractStatus,
  InspectionType,
  InvoiceStatus,
  StorageUnitKind,
  UserRole,
} from '@storage/types';
import { type DataSource, In } from 'typeorm';
import { loadFirstRentSummaries } from './first-rent.util';

/** A shelf contract waiting at the counter for its signed files and first month. */
export interface ShelfSigningRecord {
  id: string;
  contractNo: string;
  /** The booked start: when the customer said they would come. */
  effectiveAt: Date;
  unitCode: string;
  facilityName: string | null;
  customer: { fullName: string | null; phone: string | null };
  assignee: { id: string; fullName: string } | null;
  hasDocuments: boolean;
  firstRentPaid: boolean;
}

/**
 * DRAFT shelf contracts still to be signed (those with a handover are worked from it instead):
 * staff see the ones assigned to them, managers every one of the facilities they manage.
 */
export async function listShelfSignings(
  dataSource: DataSource,
  actor: AuthUser,
): Promise<ShelfSigningRecord[]> {
  const query = dataSource
    .getRepository(Contract)
    .createQueryBuilder('c')
    .innerJoinAndSelect('c.bookingItem', 'item')
    .innerJoinAndSelect('item.storageUnit', 'unit')
    .leftJoinAndSelect('unit.facility', 'facility')
    .leftJoinAndSelect('c.customer', 'customer')
    .where('c.status = :draft', { draft: ContractStatus.DRAFT })
    .andWhere('unit.kind = :shelf', { shelf: StorageUnitKind.SHELF })
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM "inspections" i
                    WHERE i."contract_id" = c."id" AND i."type" = :handover)`,
      { handover: InspectionType.PRE_HANDOVER },
    )
    .orderBy('c.effectiveAt', 'ASC');

  if (actor.roles.includes(UserRole.FACILITY_MANAGER) && !isGlobalManager(actor)) {
    const managed = await loadManagedFacilityIds(dataSource.manager, actor.id);
    if (managed.length === 0) return [];
    query.andWhere('unit.facilityId IN (:...managed)', { managed });
  } else if (!isGlobalManager(actor)) {
    query.andWhere('c.assignedTo = :me', { me: actor.id });
  }

  const contracts = await query.getMany();
  if (contracts.length === 0) return [];
  const assigneeIds = [...new Set(contracts.flatMap((c) => (c.assignedTo ? [c.assignedTo] : [])))];
  const [firstRents, assignees] = await Promise.all([
    loadFirstRentSummaries(
      dataSource,
      contracts.map((c) => c.id),
    ),
    assigneeIds.length
      ? dataSource.getRepository(AppUser).find({ where: { id: In(assigneeIds) } })
      : Promise.resolve([] as AppUser[]),
  ]);
  const assigneeById = new Map(assignees.map((user) => [user.id, user]));

  return contracts.map((contract) => {
    const unit = contract.bookingItem.storageUnit;
    const assignee = contract.assignedTo ? assigneeById.get(contract.assignedTo) : undefined;
    return {
      id: contract.id,
      contractNo: contract.contractNo,
      effectiveAt: contract.effectiveAt,
      unitCode: unit.code,
      facilityName: unit.facility?.name ?? null,
      customer: {
        fullName: contract.customer?.fullName ?? null,
        phone: contract.customer?.phone ?? null,
      },
      assignee: assignee ? { id: assignee.id, fullName: assignee.fullName } : null,
      hasDocuments: (contract.documents?.length ?? 0) > 0,
      firstRentPaid: firstRents.get(contract.id)?.status === InvoiceStatus.PAID,
    };
  });
}
