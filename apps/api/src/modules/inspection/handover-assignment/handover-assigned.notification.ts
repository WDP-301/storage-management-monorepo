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
