import type { CreatePickupRequestInput } from '@storage/types';

/** Pure rules for the customer's pick-up request form, kept apart from the UI so they are testable. */

export const FIRST_HOUR = 8;
export const LAST_HOUR = 20;
export const MAX_DAYS_AHEAD = 30;
export const NOTE_MAX = 500;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (hour: number) => String(hour).padStart(2, '0');

/** The API requires an explicit offset, so the pick-up time always means Vietnam time. */
export const requestedForIso = (dayIso: string, hour: number): string =>
  `${dayIso}T${pad(hour)}:00:00+07:00`;

export const hourLabel = (hour: number): string => `${pad(hour)}:00`;

/** Last day a request may be made for, counted from today in Vietnam. */
export function lastRequestDay(todayIso: string): string {
  return new Date(Date.parse(`${todayIso}T00:00:00.000Z`) + MAX_DAYS_AHEAD * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Opening hours of the counter; on the current day only the hours that have not started yet. */
export function availableHours(dayIso: string, nowMs: number): number[] {
  const hours: number[] = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
    if (Date.parse(requestedForIso(dayIso, hour)) > nowMs) hours.push(hour);
  }
  return hours;
}

export const vietnamToday = (nowMs: number): string =>
  new Date(nowMs + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);

type StockItem = { id: string; name: string; quantity: number };

export type PickupDraftResult = { input: CreatePickupRequestInput } | { error: string };

/** Validates the form and shapes the request body; `error` is ready to show the customer. */
export function toPickupRequestInput(
  items: readonly StockItem[],
  quantities: Readonly<Record<string, number>>,
  dayIso: string | null,
  hour: number | null,
  note: string,
): PickupDraftResult {
  const lines: CreatePickupRequestInput['lines'] = [];
  for (const item of items) {
    const quantity = quantities[item.id] ?? 0;
    if (quantity <= 0) continue;
    if (!Number.isInteger(quantity) || quantity > item.quantity) {
      return { error: `${item.name}: chỉ còn ${item.quantity} trên kệ.` };
    }
    lines.push({ itemId: item.id, quantity });
  }
  if (lines.length === 0) return { error: 'Chọn ít nhất một món cần lấy.' };
  if (!dayIso) return { error: 'Chọn ngày lấy đồ.' };
  if (hour === null) return { error: 'Chọn giờ lấy đồ.' };
  const trimmed = note.trim();
  if (trimmed.length > NOTE_MAX) return { error: `Ghi chú tối đa ${NOTE_MAX} ký tự.` };
  return {
    input: {
      lines,
      requestedFor: requestedForIso(dayIso, hour),
      ...(trimmed ? { note: trimmed } : {}),
    },
  };
}
