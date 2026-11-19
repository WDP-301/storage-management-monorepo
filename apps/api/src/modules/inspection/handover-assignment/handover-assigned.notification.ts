import type { NotificationPayload } from '@modules/notifications/types/notification';
import { NotificationType } from '@storage/types';

const VIETNAM_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function handoverAssignedNotification(input: {
  bookingId: string;
  facilityId: string;
  inspectionIds: string[];
  unitCodes: string[];
  firstHandoverAt: Date;
}): NotificationPayload {
  return {
    type: NotificationType.HANDOVER_ASSIGNED,
    title: 'Được giao việc bàn giao kho',
    body: `Bạn sẽ bàn giao ${input.unitCodes.join(', ')} cho khách lúc ${VIETNAM_TIME.format(input.firstHandoverAt)}.`,
    data: {
      bookingId: input.bookingId,
      facilityId: input.facilityId,
      inspectionIds: input.inspectionIds,
    },
  };
}

/** A shelf has no handover: the assignee meets the customer at the counter to sign and collect. */
export function shelfContractAssignedNotification(input: {
  bookingId: string;
  facilityId: string;
  contractIds: string[];
  shelfCodes: string[];
  firstVisitAt: Date;
}): NotificationPayload {
  return {
    type: NotificationType.HANDOVER_ASSIGNED,
    title: 'Được giao việc ký hợp đồng kệ',
    body:
      `Khách thuê kệ ${input.shelfCodes.join(', ')} hẹn tới quầy lúc ` +
      `${VIETNAM_TIME.format(input.firstVisitAt)} — nhận file hợp đồng đã ký và thu tiền tháng đầu.`,
    data: {
      bookingId: input.bookingId,
      facilityId: input.facilityId,
      contractId: input.contractIds[0],
      contractIds: input.contractIds,
    },
  };
}

export interface ReturnJob {
  inspectionId: string;
  contractId: string;
  facilityId: string;
  unitCode: string | null;
  scheduledAt: Date;
}

const returnData = (job: ReturnJob) => ({
  inspectionId: job.inspectionId,
  inspectionIds: [job.inspectionId],
  contractId: job.contractId,
  facilityId: job.facilityId,
  scheduledAt: job.scheduledAt.toISOString(),
});

const unitOf = (job: ReturnJob) => (job.unitCode ? `kho ${job.unitCode}` : 'kho');

/** To the staff member now meeting the customer for the return. */
export function returnAssignedNotification(job: ReturnJob): NotificationPayload {
  return {
    type: NotificationType.RETURN_ASSIGNED,
    title: 'Được giao việc nhận trả kho',
    body: `Bạn sẽ kiểm tra và nhận trả ${unitOf(job)} cùng khách lúc ${VIETNAM_TIME.format(job.scheduledAt)}.`,
    data: returnData(job),
  };
}

/** To the inspector who keeps a return whose appointment moved. */
export function returnMovedNotification(job: ReturnJob): NotificationPayload {
  return {
    type: NotificationType.RETURN_RESCHEDULED,
    title: 'Đổi lịch nhận trả kho',
    body: `Lịch nhận trả ${unitOf(job)} đã đổi sang ${VIETNAM_TIME.format(job.scheduledAt)}.`,
    data: returnData(job),
  };
}

/** To the inspector who lost a return: it moved outside their shift and went to someone else. */
export function returnReassignedNotification(job: ReturnJob): NotificationPayload {
  return {
    type: NotificationType.RETURN_REASSIGNED,
    title: 'Việc nhận trả kho đã chuyển người',
    body:
      `Lịch nhận trả ${unitOf(job)} đã đổi sang ${VIETNAM_TIME.format(job.scheduledAt)}, ngoài ca ` +
      'của bạn — đã giao cho nhân viên khác trực ca.',
    data: returnData(job),
  };
}
