import { Inspection } from '@entities/inspection.entity';
import { staffStarted } from '@modules/contracts/contract-return.util';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import { InspectionType } from '@storage/types';
import { type EntityManager, IsNull } from 'typeorm';
import { facilityStaff, lastAssignedStaffId, staffOnShiftFor } from './assignment-queries';
import {
  type ReturnJob,
  returnAssignedNotification,
  returnMovedNotification,
  returnReassignedNotification,
} from './handover-assigned.notification';
import { nextInRotation } from './handover-rotation';

/**
 * Gives an open return to a staff member of the unit's facility whose shift covers the
 * appointment, round robin by name. The current inspector keeps it while on shift at that time,
 * once they have started the record, or when nobody else is on shift — then a manager decides.
 * Returns the inspector afterwards, or null when the return is still unassigned.
 *
 * After a `moved` appointment the inspector is told: the one keeping it gets the new time, the
 * one losing it learns it went to someone else (who gets the usual assignment notice).
 *
 * The row is locked first: callers moving or creating the return already hold it, while the
 * shift-added sweep skips a return someone else is editing — that edit re-assigns it itself —
 * instead of deciding on a stale read or deadlocking with it.
 */
export async function assignReturn(
  em: EntityManager,
  inspectionId: string,
  notifications: Pick<NotificationsService, 'createForUsers'>,
  moved = false,
): Promise<string | null> {
  // FOR UPDATE cannot lock the nullable side of an outer join, so the relations load after.
  const locked = await em.findOne(Inspection, {
    where: { id: inspectionId },
    lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
  });
  if (!locked) return null;
  const inspection = await em.findOne(Inspection, {
    where: { id: inspectionId },
    relations: { contract: { bookingItem: { storageUnit: true } } },
  });
  if (!inspection || inspection.type !== InspectionType.RETURN) return null;
  const current = inspection.inspectedBy ?? null;
  const unit = inspection.contract?.bookingItem?.storageUnit;
  const facilityId = unit?.facilityId;
  if (inspection.finalizedAt || !inspection.scheduledAt || !facilityId) return current;

  const job: ReturnJob = {
    inspectionId: inspection.id,
    contractId: inspection.contractId,
    facilityId,
    unitCode: unit?.code ?? null,
    scheduledAt: inspection.scheduledAt,
  };
  const keep = async (): Promise<string | null> => {
    if (moved && current) {
      await notifications.createForUsers(em, [current], returnMovedNotification(job));
    }
    return current;
  };
  if (current && staffStarted(inspection)) return keep();

  // Two returns booked at once must not both read the same "last assigned" person.
  await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`return_rotation:${facilityId}`]);
  const staff = await facilityStaff(em, facilityId);
  const onShift = await staffOnShiftFor(em, facilityId, staff, [job.scheduledAt]);
  if (current && onShift.has(current)) return keep();

  const staffId = nextInRotation(
    staff,
    await lastAssignedStaffId(em, facilityId, InspectionType.RETURN),
    onShift,
  );
  if (!staffId) return keep();

  await em.update(
    Inspection,
    { id: inspection.id, finalizedAt: IsNull() },
    { inspectedBy: staffId },
  );
  await notifications.createForUsers(em, [staffId], returnAssignedNotification(job));
  if (current) {
    await notifications.createForUsers(em, [current], returnReassignedNotification(job));
  }
  return staffId;
}
