import type { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import { changesAppointmentDay, moveReturn } from '@modules/contracts/contract-return.util';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { HttpStatus } from '@nestjs/common';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { formatVietnamDate } from '@shared/utils/calendar.util';
import { InspectionType, NotificationType } from '@storage/types';

/**
 * A return appointment moved through the inspection. The appointment is only a schedule (money
 * counts to the day the return is finalized), and only managers of the facility move it — from
 * the web; the assigned inspector cannot. A form that sends back the day it already has is not a
 * move: it passes for anyone, even once that day is in the past, and a handover's own day is
 * accepted unchanged. Moving a handover appointment is not done here. Returns whether the day
 * changed, so the customer can be told.
 */
export function rescheduleInspection(
  inspection: Inspection,
  scheduledAt: Date,
  actorManages: boolean,
  now: Date = new Date(),
): boolean {
  const moved = changesAppointmentDay(inspection, scheduledAt);
  if (inspection.type !== InspectionType.RETURN) {
    if (!moved) return false;
    throw fieldValidationError(
      'scheduledAt',
      'returnOnly',
      'Chỉ đổi được ngày hẹn của biên trả kho',
    );
  }
  if (moved && !actorManages) {
    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'Chỉ quản lý chi nhánh đổi được ngày hẹn trả kho',
      HttpStatus.FORBIDDEN,
      { inspectionId: inspection.id },
    );
  }
  moveReturn(inspection, scheduledAt, now);
  return moved;
}

/** Tells the customer the branch moved their return appointment. */
export function returnRescheduledNotification(
  contract: Pick<Contract, 'id' | 'contractNo'>,
  inspection: Pick<Inspection, 'id' | 'scheduledAt'>,
  unitCode: string | null,
): NotificationPayload {
  const unit = unitCode ? `kho ${unitCode}` : `kho của hợp đồng ${contract.contractNo}`;
  const day = inspection.scheduledAt ? formatVietnamDate(inspection.scheduledAt) : null;
  return {
    type: NotificationType.RETURN_RESCHEDULED,
    title: 'Đổi lịch hẹn trả kho',
    body: day
      ? `Chi nhánh đã đổi lịch hẹn trả ${unit} sang ngày ${day}`
      : `Chi nhánh đã đổi lịch hẹn trả ${unit}`,
    data: {
      contractId: contract.id,
      contractNo: contract.contractNo,
      inspectionId: inspection.id,
      scheduledAt: inspection.scheduledAt?.toISOString() ?? null,
    },
  };
}
