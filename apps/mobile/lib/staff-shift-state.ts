import type { StaffShiftStatus } from '@storage/types';
import type { StaffShiftRecord } from '../src/types/staff-shift-api';
import { ApiError } from './api';

/** Server opens check-in 30 minutes before `start_at` until `end_at`. */
export const CHECK_IN_OPENS_BEFORE_MS = 30 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ShiftStatusDisplay = {
  label: string;
  tone: 'info' | 'warning' | 'success' | 'neutral' | 'danger';
};

const SHIFT_STATUS_DISPLAY: Record<StaffShiftStatus, ShiftStatusDisplay> = {
  SCHEDULED: { label: 'Đã xếp lịch', tone: 'info' },
  CHECKED_IN: { label: 'Đang trong ca', tone: 'warning' },
  COMPLETED: { label: 'Hoàn thành', tone: 'success' },
  ABSENT: { label: 'Vắng mặt', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

const SHIFT_STATUS_LOOKUP = new Map<string, ShiftStatusDisplay>(
  Object.entries(SHIFT_STATUS_DISPLAY),
);

export function shiftStatusDisplay(status: string): ShiftStatusDisplay {
  return SHIFT_STATUS_LOOKUP.get(status) ?? { label: status, tone: 'neutral' };
}

/** Current Vietnam calendar day (`YYYY-MM-DD`). */
export function vietnamTodayIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds `days` calendar days to an ISO `YYYY-MM-DD` date safely in UTC. */
export function addDaysIso(iso: string, days: number): string {
  const time = Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS;
  return new Date(time).toISOString().slice(0, 10);
}

/** Monday–Sunday week containing Vietnam today, shifted by `weekOffset` weeks (7 days <= 31-day cap). */
export function shiftWeekRange(
  weekOffset: number = 0,
  nowMs: number = Date.now(),
): { from: string; to: string } {
  const today = vietnamTodayIso(nowMs);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (weekday + 6) % 7;
  const from = addDaysIso(today, -daysSinceMonday + weekOffset * 7);
  const to = addDaysIso(from, 6);
  return { from, to };
}

/** Vietnam `HH:mm` for an ISO timestamp (using +07:00 explicitly so Hermes timezone quirks cannot drift). */
export function formatVietnamTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '--:--';
  const vn = new Date(ms + VIETNAM_OFFSET_MS);
  const h = String(vn.getUTCHours()).padStart(2, '0');
  const m = String(vn.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function canCheckInShift(shift: StaffShiftRecord, nowMs: number = Date.now()): boolean {
  if (shift.status !== 'SCHEDULED') return false;
  const startMs = Date.parse(shift.start_at);
  const endMs = Date.parse(shift.end_at);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
  return nowMs >= startMs - CHECK_IN_OPENS_BEFORE_MS && nowMs < endMs;
}

export function canCheckOutShift(shift: StaffShiftRecord): boolean {
  return shift.status === 'CHECKED_IN';
}

export type ShiftAttendanceHint =
  | { kind: 'check-in' }
  | { kind: 'check-out' }
  | { kind: 'waiting'; text: string }
  | { kind: 'missed'; text: string }
  | null;

export function shiftAttendanceHint(
  shift: StaffShiftRecord,
  nowMs: number = Date.now(),
): ShiftAttendanceHint {
  if (canCheckOutShift(shift)) return { kind: 'check-out' };
  if (shift.status !== 'SCHEDULED') return null;

  const startMs = Date.parse(shift.start_at);
  const endMs = Date.parse(shift.end_at);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;

  const opensAtMs = startMs - CHECK_IN_OPENS_BEFORE_MS;
  if (nowMs < opensAtMs) {
    return {
      kind: 'waiting',
      text: `Mở check-in từ ${formatVietnamTime(new Date(opensAtMs).toISOString())}`,
    };
  }
  if (nowMs >= endMs) {
    return { kind: 'missed', text: 'Đã quá giờ check-in ca làm' };
  }
  return { kind: 'check-in' };
}

/** Orders today's check-in/active/upcoming shift first for the staff Today banner. */
export function pickTodayActiveShift(
  shifts: readonly StaffShiftRecord[],
  nowMs: number = Date.now(),
): StaffShiftRecord | null {
  const today = vietnamTodayIso(nowMs);
  const todays = shifts.filter(
    (s) => s.work_date === today && s.status !== 'CANCELLED' && s.status !== 'ABSENT',
  );
  if (todays.length === 0) return null;
  const checkedIn = todays.find((s) => s.status === 'CHECKED_IN');
  if (checkedIn) return checkedIn;
  const checkInReady = todays.find((s) => canCheckInShift(s, nowMs));
  if (checkInReady) return checkInReady;
  const upcoming = todays.find((s) => s.status === 'SCHEDULED' && Date.parse(s.end_at) > nowMs);
  return upcoming ?? todays[0];
}

export function describeShiftError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'STAFF_SHIFT_CHECK_IN_NOT_ALLOWED') {
    return 'Chỉ check-in được từ trước giờ vào ca 30 phút cho đến hết giờ làm.';
  }
  if (error.code === 'STAFF_SHIFT_CHECK_OUT_NOT_ALLOWED') {
    return 'Không thể check-out — ca này không ở trạng thái đang làm việc.';
  }
  if (error.code === 'FORBIDDEN' || error.statusCode === 403) {
    return 'Tài khoản này không có vai trò nhân viên chi nhánh để chấm công ca.';
  }
  return error.message || fallback;
}
