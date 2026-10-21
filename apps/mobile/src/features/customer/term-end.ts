import { addDaysIso, daysBetweenIso, vietnamDayIso } from '../../../lib/settlement-format';
import type { ApiContract } from '../../types/contract-api';

export type TermEndState =
  | { kind: 'ending'; lastDay: string; penaltyFromDay: string }
  | { kind: 'overdue'; lastDay: string; daysOverdue: number };

/**
 * Whether an ACTIVE contract needs a term-end notice today (Vietnam days), mirroring the daily
 * reminder: overdue from the term end day on unless a return is booked for today or later;
 * ending from `noticeDays` before the last day, only while no return is booked.
 */
export function termEndState(
  contract: Pick<ApiContract, 'status' | 'termEndAt' | 'return'>,
  todayIso: string,
  noticeDays: number,
): TermEndState | null {
  if (contract.status !== 'ACTIVE' || !contract.termEndAt) return null;
  const termEndDay = vietnamDayIso(contract.termEndAt);
  if (!termEndDay) return null;
  const lastDay = addDaysIso(termEndDay, -1);
  const open = contract.return && !contract.return.finalizedAt ? contract.return : null;

  if (todayIso >= termEndDay) {
    const booked = open?.scheduledAt ? vietnamDayIso(open.scheduledAt) : null;
    if (open && !(booked && booked < todayIso)) return null;
    return { kind: 'overdue', lastDay, daysOverdue: daysBetweenIso(lastDay, todayIso) };
  }
  if (open || todayIso < addDaysIso(lastDay, -noticeDays)) return null;
  return { kind: 'ending', lastDay, penaltyFromDay: addDaysIso(termEndDay, 1) };
}
