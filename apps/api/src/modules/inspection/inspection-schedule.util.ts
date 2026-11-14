import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import { changesAppointment, moveReturn } from '@modules/contracts/contract-return.util';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import type { ShiftWindow } from '@modules/shift-templates/shift-time';
import { HttpStatus } from '@nestjs/common';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { formatVietnamDate, vietnamDate } from '@shared/utils/calendar.util';
import { InspectionType, NotificationType } from '@storage/types';

/**
 * A return appointment moved through the inspection. The appointment is only a schedule (money
 * counts to the day the return is finalized), and only managers of the facility move it — from
 * the web; the assigned inspector cannot. A form that sends back the appointment it already has
 * is not a move: it passes for anyone, even once that time is in the past, and a handover's own
 * appointment is accepted unchanged. Moving a handover appointment is not done here. A move must
 * land on a future in-shift time. Returns whether it moved, so the customer can be told and the
 * return re-assigned.
 */
export function rescheduleInspection(
  inspection: Inspection,
  scheduledAt: Date,
  actorManages: boolean,
  templates: readonly ShiftWindow[],
  now: Date = new Date(),
): boolean {
  if (inspection.type !== InspectionType.RETURN) {
    // A handover's own day sent back (any time of it) changes nothing.
    const sameDay =
      inspection.scheduledAt != null &&
      vietnamDate(inspection.scheduledAt) === vietnamDate(scheduledAt);
    if (sameDay) return false;
    throw fieldValidationError(
      'scheduledAt',
      'returnOnly',
      'Chỉ đổi được ngày hẹn của biên trả kho',
    );
  }
  if (changesAppointment(inspection, scheduledAt) && !actorManages) {
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'Chỉ quản lý chi nhánh đổi được ngày hẹn trả kho',
      HttpStatus.FORBIDDEN,
      { inspectionId: inspection.id },
    );
  }
  return moveReturn(inspection, scheduledAt, templates, now);
}

const VIETNAM_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
});

/** Tells the customer the branch moved their return appointment. */
export function returnRescheduledNotification(
  contract: Pick<Contract, 'id' | 'contractNo'>,
  inspection: Pick<Inspection, 'id' | 'scheduledAt'>,
  unitCode: string | null,
): NotificationPayload {
  const unit = unitCode ? `kho ${unitCode}` : `kho của hợp đồng ${contract.contractNo}`;
  const at = inspection.scheduledAt
    ? `${VIETNAM_TIME.format(inspection.scheduledAt)} ngày ${formatVietnamDate(inspection.scheduledAt)}`
    : null;
  return {
    type: NotificationType.RETURN_RESCHEDULED,
    title: 'Đổi lịch hẹn trả kho',
    body: at
      ? `Chi nhánh đã đổi lịch hẹn trả ${unit} sang ${at}`
      : `Chi nhánh đã đổi lịch hẹn trả ${unit}`,
    data: {
      contractId: contract.id,
      contractNo: contract.contractNo,
      inspectionId: inspection.id,
      scheduledAt: inspection.scheduledAt?.toISOString() ?? null,
    },
  };
}
