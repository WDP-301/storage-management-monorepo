import type { ApiResponse, ClientSettingsResponse, ClientUnitChangeSettings } from '@storage/types';
import { apiClient } from './api';
import { vnTimeOfDay } from './vn-day';

/** An OFFICE work-shift window, as served by `GET /bookings/receiving-slots`. */
export interface MoveWindow {
  startAt: string;
  endAt: string;
}

export interface MoveTimeOption {
  value: string;
  label: string;
}

/** Seeded move window, used until the live one loads (the API re-checks every pick anyway). */
export const DEFAULT_UNIT_CHANGE_WINDOW: ClientUnitChangeSettings = {
  minLeadDays: 1,
  maxDaysAhead: 90,
};

export const MoveSlotsApi = {
  /** The future part of one Vietnam day's OFFICE windows — the hours a move can be staffed. */
  windows: async (day: string): Promise<MoveWindow[]> => {
    const res = await apiClient.get<
      ApiResponse<{ days: { date: string; windows: MoveWindow[] }[] }>
    >('/bookings/receiving-slots', { params: { from: day, to: day } });
    return res.data.data.days.find((d) => d.date === day)?.windows ?? [];
  },

  /** The admin-configured days a unit-change move may land on. */
  unitChangeWindow: async (): Promise<ClientUnitChangeSettings> => {
    const res = await apiClient.get<ApiResponse<ClientSettingsResponse>>('/settings/client');
    return res.data.data.unitChange ?? DEFAULT_UNIT_CHANGE_WINDOW;
  },
};

/** A window too short for a whole-hour slot still offers one, rounded up to this step. */
const SHORT_WINDOW_STEP_MS = 15 * 60_000;

/**
 * On-the-hour slots inside the windows, labelled in Vietnam time. Windows already start at `now`,
 * so slots begin at the next whole hour. A window too short for one offers its start rounded up
 * to the quarter hour — a trimmed start is the fetch instant, already past on submit.
 */
export function moveTimeOptions(
  windows: readonly MoveWindow[],
  stepMinutes = 60,
): MoveTimeOption[] {
  const stepMs = stepMinutes * 60_000;
  const options: MoveTimeOption[] = [];
  for (const window of windows) {
    const start = new Date(window.startAt).getTime();
    const end = new Date(window.endAt).getTime();
    const aligned = Math.ceil(start / stepMs) * stepMs;
    const begin =
      aligned < end ? aligned : Math.ceil(start / SHORT_WINDOW_STEP_MS) * SHORT_WINDOW_STEP_MS;
    for (let at = begin; at < end; at += stepMs) {
      const value = new Date(at).toISOString();
      options.push({ value, label: vnTimeOfDay(value) });
    }
  }
  return options;
}

/** The slot matching `current`'s time of day, else the first one; null when there is none. */
export function pickMoveTime(
  options: readonly MoveTimeOption[],
  current: string | null,
): string | null {
  const wanted = current ? vnTimeOfDay(current) : null;
  return options.find((o) => o.label === wanted)?.value ?? options[0]?.value ?? null;
}
