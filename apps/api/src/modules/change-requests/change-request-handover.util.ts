import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { HandoverAssignmentService } from '@modules/inspection/handover-assignment/handover-assignment.service';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import {
  assertShelfEmpty,
  cancelOpenDropOffRequests,
  cancelOpenPickupRequests,
} from '@modules/shelf-storage/shelf-empty-guard.util';
import {
  ChangeRequestStatus,
  ContractStatus,
  InspectionType,
  NotificationType,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import type { EntityManager } from 'typeorm';
import { UNIT_CHANGE_NOTE } from './change-request-settle.util';

/**
 * A destination contract created by a unit change just became ACTIVE at handover — the customer
 * has physically taken the new unit. This is the moment the move really happens, so:
 * - the OLD contract is retired (CANCELLED + note), its unit → MAINTENANCE, its held deposit
 *   (already including any paid top-up) moved onto the destination contract;
 * - the request moves to AWAITING_FINAL_APPROVAL and the destination branch is asked to confirm.
 *
 * Runs inside the finalize transaction. A no-op for any contract that is not a change destination,
 * so it can be called for every PRE_HANDOVER finalize.
 */
export async function advanceChangeRequestToFinalApproval(
  em: EntityManager,
  newContractId: string,
  now: Date,
  notifications: NotificationsService,
  handoverAssignment: HandoverAssignmentService,
): Promise<UnitChangeRequest | null> {
  const request = await em.findOne(UnitChangeRequest, {
    where: { newContractId, status: ChangeRequestStatus.AWAITING_HANDOVER },
    lock: { mode: 'pessimistic_write' },
  });
  if (!request) return null;

  // Retire the old contract only if it is still live; the customer may have ended it meanwhile.
  const oldContract = await em.findOne(Contract, {
    where: { id: request.contractId },
    lock: { mode: 'pessimistic_write' },
  });
  if (oldContract && oldContract.status === ContractStatus.ACTIVE) {
    await assertShelfEmpty(em, oldContract.id, 'UNIT_CHANGE');
    await cancelOpenPickupRequests(em, oldContract.id);
    await cancelOpenDropOffRequests(em, oldContract.id);
    await em.update(
      Contract,
      { id: oldContract.id },
      { status: ContractStatus.CANCELLED, note: UNIT_CHANGE_NOTE },
    );
    await em.update(
      StorageUnit,
      { id: request.oldUnitId, status: StorageUnitStatus.RENTED },
      { status: StorageUnitStatus.MAINTENANCE },
    );

    // The vacated unit needs a maintenance check before it goes back on the market.
    const oldUnit = await em.findOne(StorageUnit, { where: { id: request.oldUnitId } });
    const inspection = await em.save(
      Inspection,
      em.create(Inspection, {
        contractId: oldContract.id,
        type: InspectionType.MAINTENANCE,
        scheduledAt: now,
      }),
    );
    // Round-robin the check to a staff member of the OLD unit's facility (HCM staff for an HCM
    // warehouse). Only fall back to the managers when that facility has nobody to take it.
    const assignedStaffId = await handoverAssignment.assignMaintenanceInspection(em, inspection.id);
    if (!assignedStaffId && oldUnit) {
      const managers = await em.find(UserRoleAssignment, {
        where: { role: UserRole.FACILITY_MANAGER, facilityId: oldUnit.facilityId },
      });
      const managerIds = [
        ...new Set(managers.filter((a) => isAssignmentActive(a)).map((a) => a.userId)),
      ];
      if (managerIds.length > 0) {
        await notifications.createForUsers(em, managerIds, {
          type: NotificationType.MAINTENANCE_CHECK_DUE,
          title: 'Cần kiểm tra kho cũ',
          body:
            `Kho ${oldUnit.code} đã trống sau khi khách chuyển đi — phân công nhân viên kiểm tra ` +
            'và trả kho về trạng thái trống.',
          data: { requestId: request.id, contractId: oldContract.id, unitId: oldUnit.id },
        });
      }
    }
  }

  // The single deposit row (already carrying any paid top-up) follows the customer to the new
  // contract. Skipped when the destination already has a row, so the unique constraint holds.
  await em.query(
    `UPDATE "deposits" SET "contract_id" = $1, "updated_at" = now()
      WHERE "contract_id" = $2
        AND NOT EXISTS (SELECT 1 FROM "deposits" d2 WHERE d2."contract_id" = $1)`,
    [newContractId, request.contractId],
  );

  request.status = ChangeRequestStatus.AWAITING_FINAL_APPROVAL;
  request.history = [
    ...(request.history ?? []),
    {
      action: 'STATUS_CHANGED',
      from: ChangeRequestStatus.AWAITING_HANDOVER,
      to: ChangeRequestStatus.AWAITING_FINAL_APPROVAL,
      at: now.toISOString(),
      by: 'system',
    },
  ];
  await em.save(UnitChangeRequest, request);

  const newUnit = request.newUnitId
    ? await em.findOne(StorageUnit, { where: { id: request.newUnitId } })
    : null;
  if (newUnit) {
    const assignments = await em.find(UserRoleAssignment, {
      where: { role: UserRole.FACILITY_MANAGER, facilityId: newUnit.facilityId },
    });
    const userIds = [
      ...new Set(assignments.filter((a) => isAssignmentActive(a)).map((a) => a.userId)),
    ];
    if (userIds.length > 0) {
      await notifications.createForUsers(em, userIds, {
        type: NotificationType.UNIT_CHANGE_READY_FOR_FINAL_APPROVAL,
        title: 'Khách đã bàn giao kho mới',
        body:
          `Kho ${newUnit.code} đã được bàn giao cho khách — xác nhận hoàn tất để khép lại yêu cầu ` +
          'đổi kho.',
        data: { requestId: request.id, newUnitId: request.newUnitId, contractId: newContractId },
      });
    }
  }
  return request;
}
