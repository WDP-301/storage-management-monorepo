import type { NotificationPayload } from '@modules/notifications/types/notification';
import { formatVietnamDate } from '@shared/utils/calendar.util';
import { NotificationType } from '@storage/types';

interface RenewalFacts {
  renewalId: string;
  contractId: string;
  contractNo: string;
  unitCode: string | null;
  months: number;
  /** Term end once approved (the new one), as an instant. */
  newTermEndAt: Date;
}

const unitText = (facts: RenewalFacts): string =>
  facts.unitCode ? `kho ${facts.unitCode}` : `hợp đồng ${facts.contractNo}`;

const data = (facts: RenewalFacts): Record<string, unknown> => ({
  renewalId: facts.renewalId,
  contractId: facts.contractId,
  contractNo: facts.contractNo,
  months: facts.months,
  newTermEndAt: facts.newTermEndAt.toISOString(),
});

/** To the branch managers: a customer asked to extend; they approve or reject on the web. */
export function renewalRequestedNotification(
  facts: RenewalFacts,
  customerName: string,
): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_RENEWAL_REQUESTED,
    title: `Yêu cầu gia hạn ${unitText(facts)}`,
    body:
      `${customerName} muốn gia hạn hợp đồng ${facts.contractNo} thêm ${facts.months} tháng ` +
      '(giữ giá thuê hiện tại). Duyệt hoặc từ chối trên trang Gia hạn hợp đồng.',
    data: data(facts),
  };
}

/**
 * The term end is a Vietnam day boundary: the last rental day is the day before it, matching the
 * term-end reminders.
 */
const lastDayText = (termEndAt: Date): string =>
  formatVietnamDate(new Date(termEndAt.getTime() - 24 * 60 * 60 * 1000));

export function renewalApprovedNotification(facts: RenewalFacts): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_RENEWAL_APPROVED,
    title: 'Đã duyệt gia hạn hợp đồng',
    body:
      `Hợp đồng ${facts.contractNo} (${unitText(facts)}) được gia hạn thêm ${facts.months} tháng, ` +
      `đến hết ngày ${lastDayText(facts.newTermEndAt)}. Tiền thuê các tháng gia hạn giữ nguyên ` +
      'và được lập hóa đơn hằng tháng như trước.',
    data: data(facts),
  };
}

export function renewalRejectedNotification(
  facts: RenewalFacts,
  reason: string,
): NotificationPayload {
  return {
    type: NotificationType.CONTRACT_RENEWAL_REJECTED,
    title: 'Yêu cầu gia hạn bị từ chối',
    body: `Yêu cầu gia hạn hợp đồng ${facts.contractNo} (${unitText(facts)}) bị từ chối: ${reason}`,
    data: { ...data(facts), reason },
  };
}

export type { RenewalFacts };
