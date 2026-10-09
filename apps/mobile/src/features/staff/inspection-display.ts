import { formatIsoDate } from '../../../lib/format-vi';
import { toIsoDate } from '../../../lib/rental-schedule';
import type { InspectionKind, StaffInspection } from '../../types/inspection-api';

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

/** What finalizing will do, spelled out in the confirmation dialog. */
export function finalizeConsequence(inspection: StaffInspection, damageCount: number): string {
  if (inspection.type === 'PRE_HANDOVER') {
    return 'Hợp đồng sẽ có hiệu lực và kho chuyển sang Đang thuê. Biên bản không sửa được sau khi chốt.';
  }
  const unit = damageCount > 0 ? 'Bảo trì (có hư hỏng)' : 'Trống';
  return `Hợp đồng kết thúc và kho chuyển sang ${unit}. Biên bản không sửa được sau khi chốt.`;
}
