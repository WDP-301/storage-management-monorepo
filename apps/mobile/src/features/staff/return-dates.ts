import { formatIsoDate } from '../../../lib/format-vi';
import { fromIsoDate, type RentalDateOption, toIsoDate } from '../../../lib/rental-schedule';
import type { StaffInspection } from '../../types/inspection-api';

/** Longest strip offered: enough to cover a return that sat open for weeks. */
export const MAX_DAY_OPTIONS = 60;

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Calendar day in Vietnam (UTC+7, no daylight saving) — the clock the API enforces date bounds on. */
export function vietnamDayIso(date: Date): string {
  return new Date(date.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const start = fromIsoDate(iso);
  return toIsoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + days));
}

function toOption(iso: string, todayIso: string): RentalDateOption {
  const date = fromIsoDate(iso);
  return {
    iso,
    weekday: WEEKDAY_LABELS[date.getDay()] ?? '',
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    isToday: iso === todayIso,
  };
}

/** Today and the days after it, for moving an appointment (the API refuses past days). */
export function rescheduleOptions(todayIso: string, days = MAX_DAY_OPTIONS): RentalDateOption[] {
  return Array.from({ length: days }, (_, offset) => toOption(addDays(todayIso, offset), todayIso));
}

/**
 * Days the unit can have come back on: the day the return was requested up to today, newest first
 * so today — the default — is the first cell instead of the end of a long strip.
 */
export function returnedOnOptions(requestedAt: string, todayIso: string): RentalDateOption[] {
  const requestedDay = vietnamDayIso(new Date(requestedAt));
  const firstDay = requestedDay < todayIso ? requestedDay : todayIso;
  const options: RentalDateOption[] = [];
  for (
    let day = todayIso;
    day >= firstDay && options.length < MAX_DAY_OPTIONS;
    day = addDays(day, -1)
  ) {
    options.push(toOption(day, todayIso));
  }
  return options;
}

/** Vietnam day of the appointment, or null when none is set. */
export function appointmentDayIso(inspection: StaffInspection): string | null {
  return inspection.scheduledAt ? vietnamDayIso(new Date(inspection.scheduledAt)) : null;
}

/** Billing counts from the later of the actual and appointed day, so a different day is flagged. */
export function returnedOnWarning(
  inspection: StaffInspection,
  returnedOnIso: string,
): string | null {
  const appointed = appointmentDayIso(inspection);
  if (!appointed || appointed === returnedOnIso) return null;
  return `Ngày trả thực tế khác ngày hẹn ${formatIsoDate(appointed).slice(0, 5)} — tiền thuê/phạt tính theo ngày muộn hơn.`;
}

/** Bringing the appointment forward restarts the customer's notice period from today. */
export function isMovedEarlier(inspection: StaffInspection, newDayIso: string): boolean {
  const appointed = appointmentDayIso(inspection);
  return appointed !== null && newDayIso < appointed;
}

export const RESCHEDULE_EARLIER_NOTE = 'Thời hạn báo trước của khách sẽ tính lại từ hôm nay.';
