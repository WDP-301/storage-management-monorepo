import type { Inspection } from '@entities/inspection.entity';
import { currentReturnRules, moveReturn } from '@modules/contracts/contract-return.util';
import type { SettingsService } from '@modules/settings/settings.service';
import { fieldValidationError } from '@shared/exceptions/domain.exception';
import { vietnamDate } from '@shared/utils/calendar.util';
import { InspectionType } from '@storage/types';

/**
 * Staff moving a return appointment: same day bounds as the customer's request, and bringing it
 * forward restarts the customer's notice from now. A form that sends back the day it already
 * has is not a move — it passes even once that day is in the past, and a handover's own day is
 * accepted unchanged. Moving a handover appointment is not done here.
 */
export async function rescheduleInspection(
  inspection: Inspection,
  scheduledAt: Date,
  settings: SettingsService,
  now: Date = new Date(),
): Promise<void> {
  if (inspection.type !== InspectionType.RETURN) {
    const sameDay =
      inspection.scheduledAt != null &&
      vietnamDate(inspection.scheduledAt) === vietnamDate(scheduledAt);
    if (sameDay) return;
    throw fieldValidationError(
      'scheduledAt',
      'returnOnly',
      'Chỉ đổi được ngày hẹn của biên trả kho',
    );
  }
  await moveReturn(inspection, scheduledAt, now, () => currentReturnRules(settings));
}
