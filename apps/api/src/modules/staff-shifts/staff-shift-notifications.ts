import type { StaffShift } from '@entities/staff-shift.entity';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { NotificationType } from '@storage/types';

/** `workDate` is a Vietnam `YYYY-MM-DD`; render it `dd/mm/yyyy` like the rest of the notices. */
function dayVi(isoDay: string): string {
  const [year, month, day] = isoDay.split('-');
  return `${day}/${month}/${year}`;
}

/** Shifts already sorted by start time, all belonging to one staff member. */
export function shiftsAssignedNotification(shifts: StaffShift[]): NotificationPayload {
  const first = shifts[0].workDate;
  const last = shifts[shifts.length - 1].workDate;
  const days = first === last ? `ngày ${dayVi(first)}` : `từ ${dayVi(first)} đến ${dayVi(last)}`;
  return {
    type: NotificationType.SHIFT_ASSIGNED,
    title: 'Bạn được xếp ca mới',
    body: `Bạn được xếp ${shifts.length} ca làm việc ${days}.`,
    data: { shiftIds: shifts.map((shift) => shift.id), facilityId: shifts[0].facilityId },
  };
}

export function shiftUpdatedNotification(shift: StaffShift): NotificationPayload {
  return {
    type: NotificationType.SHIFT_UPDATED,
    title: 'Ca làm việc thay đổi',
    body: `Ca làm việc của bạn đã chuyển sang ngày ${dayVi(shift.workDate)} — kiểm tra lại giờ trong lịch.`,
    data: { shiftId: shift.id, facilityId: shift.facilityId },
  };
}

export function shiftCancelledNotification(shift: StaffShift): NotificationPayload {
  return {
    type: NotificationType.SHIFT_CANCELLED,
    title: 'Ca làm việc đã hủy',
    body: `Ca làm việc ngày ${dayVi(shift.workDate)} của bạn đã bị hủy.`,
    data: { shiftId: shift.id, facilityId: shift.facilityId },
  };
}
