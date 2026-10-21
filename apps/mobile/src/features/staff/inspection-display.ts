import type { ReturnRequestSource } from '@storage/types';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { toIsoDate } from '../../../lib/rental-schedule';
import type { InspectionKind, StaffDamage, StaffInspection } from '../../types/inspection-api';

/** Largest fee one damage can carry, VND — the API rejects anything above. */
export const MAX_PROPOSED_FEE = 1_000_000_000;

export const INSPECTION_KIND_LABEL: Record<InspectionKind, string> = {
  PRE_HANDOVER: 'Nhận kho',
  RETURN: 'Trả kho',
  MAINTENANCE: 'Bảo trì',
};

export type ScheduleGroup = 'overdue' | 'today' | 'upcoming';

export const SCHEDULE_GROUP_LABEL: Record<ScheduleGroup, string> = {
  overdue: 'Quá hạn',
  today: 'Hôm nay',
  upcoming: 'Sắp tới',
};

/** Local calendar day of the appointment (UTC timestamps would be a day early before 07:00). */
export function scheduledDayIso(inspection: StaffInspection): string | null {
  return inspection.scheduledAt ? toIsoDate(new Date(inspection.scheduledAt)) : null;
}

export function scheduleGroup(inspection: StaffInspection, todayIso: string): ScheduleGroup {
  const day = scheduledDayIso(inspection);
  if (!day || day > todayIso) return 'upcoming';
  return day === todayIso ? 'today' : 'overdue';
}

/** Open inspections bucketed by appointment day, each bucket already sorted by the API. */
export function groupBySchedule(
  items: readonly StaffInspection[],
  todayIso: string,
): { group: ScheduleGroup; items: StaffInspection[] }[] {
  const order: ScheduleGroup[] = ['overdue', 'today', 'upcoming'];
  return order
    .map((group) => ({
      group,
      items: items.filter((item) => scheduleGroup(item, todayIso) === group),
    }))
    .filter((bucket) => bucket.items.length > 0);
}

export function scheduledLabel(inspection: StaffInspection): string {
  const day = scheduledDayIso(inspection);
  return day ? `Hẹn ${formatIsoDate(day)}` : 'Chưa hẹn ngày';
}

/**
 * Reads a fee typed into the input: digits only, empty clears it, and a value above the limit
 * is ignored so the field keeps the last acceptable amount.
 */
export function parseProposedFee(text: string, previous: number | null): number | null {
  const digits = text.replace(/\D/g, '');
  if (digits === '') return null;
  const value = Number(digits);
  return value > MAX_PROPOSED_FEE ? previous : value;
}

export function proposedFeeTotal(damages: readonly Pick<StaffDamage, 'proposedFee'>[]): number {
  return damages.reduce((sum, damage) => sum + (damage.proposedFee ?? 0), 0);
}

/** What finalizing will do, spelled out in the confirmation dialog. */
export function finalizeConsequence(
  inspection: StaffInspection,
  damages: readonly Pick<StaffDamage, 'severity' | 'proposedFee'>[],
): string {
  if (inspection.type === 'PRE_HANDOVER') {
    return 'Hợp đồng sẽ có hiệu lực và kho chuyển sang Đang thuê. Biên bản không sửa được sau khi chốt.';
  }
  // Only a major damage takes the unit out of rotation; minor wear leaves it rentable.
  const unit = damages.some((damage) => damage.severity === 'MAJOR')
    ? 'Bảo trì (có hư hỏng nặng)'
    : 'Trống';
  const consequence = `Hợp đồng kết thúc và kho chuyển sang ${unit}. Biên bản không sửa được sau khi chốt.`;
  const fees = proposedFeeTotal(damages);
  return fees > 0
    ? `${consequence}\n\nTổng phí đề xuất: ${formatMoney(fees)} — quản lý vận hành duyệt khi quyết toán cọc.`
    : consequence;
}

const REQUEST_SOURCE_LABEL: Partial<Record<ReturnRequestSource, string>> = {
  HOTLINE: 'Chi nhánh tạo yêu cầu thay khách (khách gọi hotline)',
  ABANDONED: 'Chi nhánh tạo yêu cầu thay khách (khách bỏ kho)',
};

/** Only requests a branch made for the customer are called out; the customer's own need no label. */
export function requestSourceLabel(inspection: StaffInspection): string | null {
  return inspection.requestSource ? (REQUEST_SOURCE_LABEL[inspection.requestSource] ?? null) : null;
}
