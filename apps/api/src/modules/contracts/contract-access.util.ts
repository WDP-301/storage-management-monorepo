import { BookingItem } from '@entities/booking-item.entity';
import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import { worksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { managesFacility } from '@modules/inspection/inspection-access.util';
import { ContractStatus, StorageUnitKind } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { type ContractInspections, loadContractInspections } from './contract-inspections.util';

/** What the actor may edit on a contract's three records. */
export interface ContractPermissions {
  documents: boolean;
  handover: boolean;
  return: boolean;
  /** Issue the first month's rent QR and confirm cash for it. */
  first_rent: boolean;
}

export interface ContractAccess {
  facilityId: string | null;
  isManager: boolean;
  canView: boolean;
  permissions: ContractPermissions;
  inspections: ContractInspections;
}

const EDITABLE_DOCUMENT_STATUSES: ContractStatus[] = [ContractStatus.DRAFT, ContractStatus.ACTIVE];

const isOpenAssignee = (inspection: Inspection | undefined, actorId: string): boolean =>
  !!inspection && !inspection.finalizedAt && inspection.inspectedBy === actorId;

/**
 * Pure permission rules. Managers (global, or of the unit's facility) edit anything still
 * open; staff edit only inspections assigned to them that are not yet finalized, and the
 * contract files and the first month's rent only while the contract is a DRAFT awaiting
 * that handover. `shelfStaff`: a shelf contract and the actor works at its branch — the counter
 * on duty takes the files and first month of a shelf rented without a handover, and closes a
 * shelf return, which has nothing to inspect.
 */
export function computeContractPermissions(
  status: ContractStatus,
  isManager: boolean,
  inspections: ContractInspections,
  actorId: string,
  shelfStaff = false,
): ContractPermissions {
  const open = (inspection: Inspection | undefined) =>
    !!inspection && !inspection.finalizedAt && (isManager || isOpenAssignee(inspection, actorId));
  const handover = open(inspections.handover);
  const shelfDesk = shelfStaff && !inspections.handover;
  return {
    documents:
      EDITABLE_DOCUMENT_STATUSES.includes(status) &&
      (isManager ||
        (status === ContractStatus.DRAFT &&
          (isOpenAssignee(inspections.handover, actorId) || shelfDesk))),
    handover,
    return:
      open(inspections.return) ||
      (shelfStaff && !!inspections.return && !inspections.return.finalizedAt),
    // Collected at check-in, by whoever may sign the handover off (or serves the shelf counter).
    first_rent: status === ContractStatus.DRAFT && (handover || shelfDesk),
  };
}

/**
 * Single source of truth for who may see and edit a contract's file record: used by both
 * the documents write and the staff view, so they cannot disagree.
 */
export async function resolveContractAccess(
  em: EntityManager,
  contract: Contract,
  actor: AuthUser,
): Promise<ContractAccess> {
  const unit =
    contract.bookingItem?.storageUnit ??
    (
      await em.findOne(BookingItem, {
        where: { id: contract.bookingItemId },
        relations: { storageUnit: true },
      })
    )?.storageUnit ??
    null;
  const facilityId = unit?.facilityId ?? null;
  const isManager = await managesFacility(em, actor, facilityId);
  const inspections = (await loadContractInspections(em, [contract.id])).get(contract.id) ?? {};
  const isAssignedStaff =
    inspections.handover?.inspectedBy === actor.id || inspections.return?.inspectedBy === actor.id;
  const shelfStaff =
    unit?.kind === StorageUnitKind.SHELF &&
    (isManager || (await worksAtFacility(em, actor, unit.facilityId)));
  return {
    facilityId,
    isManager,
    canView: isManager || isAssignedStaff || shelfStaff,
    permissions: computeContractPermissions(
      contract.status,
      isManager,
      inspections,
      actor.id,
      shelfStaff,
    ),
    inspections,
  };
}
