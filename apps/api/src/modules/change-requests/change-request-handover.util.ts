import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { resolveContractDeposit } from '@modules/contracts/deposit-ledger.util';
import type { HandoverAssignmentService } from '@modules/inspection/handover-assignment/handover-assignment.service';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import {
  cancelOpenDropOffRequests,
  cancelOpenPickupRequests,
} from '@modules/shelf-storage/shelf-empty-guard.util';
import { Logger } from '@nestjs/common';
import { vietnamDate } from '@shared/utils/calendar.util';
import {
  ChangeRequestStatus,
  ContractStatus,
  InspectionType,
  NotificationType,
  StorageUnitKind,
  StorageUnitStatus,
  UserRole,
} from '@storage/types';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';
import { settleRentNetOnDeposit } from './change-request-charges.util';
import { UNIT_CHANGE_NOTE } from './change-request-settle.util';

const DAY_MS = 86_400_000;
const logger = new Logger('ChangeRequestHandover');

/** Open (not voided, not yet terminal) rent invoices of the contract being retired. */
interface RentInvoiceRow {
  id: string;
  status: string;
  startAt: Date | null;
  endAt: Date | null;
  total: string;
  paid: string;
}

const dayDiff = (fromDay: string, toDay: string): number =>
  Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS);

/**
 * The move day is the last day on the old unit: rent periods up to it are owed in full, the
 * period covering it is pro-rated, and anything later is free. The net of what was paid versus
 * what is owed rides the deposit that moves to the new contract — a shortfall is collected from
 * it (what it cannot cover is billed), an overpayment is parked in it (it comes back at the final
 * settlement).
 * Every open rent invoice is then VOID so none of it can be paid a second time or block the
 * customer as "overdue" on a contract that no longer rents anything.
 */
export async function settleOldContractRent(
  em: EntityManager,
  oldContractId: string,
  moveAt: Date,
): Promise<Decimal> {
  const moveDay = vietnamDate(moveAt);
  const invoices = (await em.query(
    `SELECT i."id", i."status", i."start_at" AS "startAt", i."end_at" AS "endAt",
            i."total"::text AS "total",
            COALESCE(p."paid", 0)::text AS "paid"
       FROM "invoices" i
       LEFT JOIN (SELECT "invoice_id", SUM("amount") AS "paid"
                    FROM "payments" WHERE "status" = 'SUCCEEDED'
                    GROUP BY "invoice_id") p ON p."invoice_id" = i."id"
      WHERE i."contract_id" = $1 AND i."kind" IN ('INITIAL', 'RENEWAL')
        AND i."status" <> 'VOID'
      ORDER BY i."start_at" NULLS FIRST, i."created_at"
      FOR UPDATE OF i`,
    [oldContractId],
  )) as RentInvoiceRow[];

  let net = new Decimal(0);
  const openIds: string[] = [];
  for (const invoice of invoices) {
    const startDay = invoice.startAt ? vietnamDate(invoice.startAt) : null;
    const endDay = invoice.endAt ? vietnamDate(invoice.endAt) : null;
    const total = new Decimal(invoice.total);
    let owed = new Decimal(0);
    if (startDay && startDay < moveDay) {
      if (!endDay || endDay <= moveDay) {
        owed = total; // Period already over by the move day — owed in full.
      } else {
        // Period covering the move day: charge only the days actually used.
        const daysUsed = dayDiff(startDay, moveDay);
        const daysTotal = Math.max(dayDiff(startDay, endDay), 1);
        owed = total.times(daysUsed).div(daysTotal).toDecimalPlaces(2);
      }
    }
    net = net.plus(new Decimal(invoice.paid)).minus(owed);
    if (invoice.status !== 'PAID') openIds.push(invoice.id);
  }

  if (openIds.length > 0) {
    await em.query(
      `UPDATE "invoices" SET "status" = 'VOID', "updated_at" = now()
        WHERE "id" = ANY($1::uuid[])`,
      [openIds],
    );
  }
  return net;
}

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
    // Materialise the old deposit row while oldContract is still ACTIVE so the transfer below
    // always finds a row even when no top-up was billed and the contract had only booking totals.
    const oldDeposit = await resolveContractDeposit(em, oldContract, { create: true });
    await cancelOpenPickupRequests(em, oldContract.id);
    await cancelOpenDropOffRequests(em, oldContract.id);

    // Rent on the old unit stops at the move day: what is still owed comes out of the deposit,
    // what was overpaid rides inside it — both before the row moves to the new contract.
    const rentNet = await settleOldContractRent(em, oldContract.id, now);
    if (rentNet.gt(0) && !oldDeposit) {
      logger.warn(
        `Unit-change rent of contract ${oldContract.id} (${rentNet.toFixed(2)}) has no ` +
          'deposit to ride — reconcile it by hand',
      );
    }
    await settleRentNetOnDeposit(em, {
      oldContract,
      newContractId,
      oldDeposit,
      rentNet,
      notifications,
      now,
    });

    const oldUnit = await em.findOne(StorageUnit, { where: { id: request.oldUnitId } });
    if (oldUnit?.kind === StorageUnitKind.SHELF) {
      // Shelf stock and receipt history follow the customer's active rental onto the new shelf;
      // receipts retain their storage_unit_id/warehouse_id/facility_id snapshots.
      await em.query(
        `UPDATE "shelf_items" SET "contract_id" = $1, "updated_at" = now()
          WHERE "contract_id" = $2`,
        [newContractId, oldContract.id],
      );
      await em.query(
        `UPDATE "shelf_receipts" SET "contract_id" = $1
          WHERE "contract_id" = $2`,
        [newContractId, oldContract.id],
      );
    }
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
          data: {
            inspectionId: inspection.id,
            requestId: request.id,
            contractId: oldContract.id,
            unitId: oldUnit.id,
          },
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
