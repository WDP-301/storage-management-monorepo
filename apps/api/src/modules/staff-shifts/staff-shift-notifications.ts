import type { StaffShift } from '@entities/staff-shift.entity';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { NotificationType } from '@storage/types';

/** Shifts already sorted by start time, all belonging to one staff member. */
export function shiftsAssignedNotification(shifts: StaffShift[]): NotificationPayload {
  const first = shifts[0].workDate;
  const last = shifts[shifts.length - 1].workDate;
  const days = first === last ? `on ${first}` : `from ${first} to ${last}`;
  return {
    type: NotificationType.SHIFT_ASSIGNED,
    title: 'New shifts assigned',
    body: `You have been scheduled for ${shifts.length} shift(s) ${days}.`,
    data: { shiftIds: shifts.map((shift) => shift.id), facilityId: shifts[0].facilityId },
  };
}

export function shiftUpdatedNotification(shift: StaffShift): NotificationPayload {
  return {
    type: NotificationType.SHIFT_UPDATED,
    title: 'Shift changed',
    body: `Your shift is now on ${shift.workDate}; check the new time in your schedule.`,
    data: { shiftId: shift.id, facilityId: shift.facilityId },
  };
}

export function shiftCancelledNotification(shift: StaffShift): NotificationPayload {
  return {
    type: NotificationType.SHIFT_CANCELLED,
    title: 'Shift cancelled',
    body: `Your shift on ${shift.workDate} has been cancelled.`,
    data: { shiftId: shift.id, facilityId: shift.facilityId },
  };
}
