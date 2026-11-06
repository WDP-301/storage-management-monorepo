import type { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType, type PickupRequestView } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { linesSummary } from '../shelf-storage/shelf-rules';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `09:30 10/11` in Vietnam time, without Intl so the output is fixed across runtimes. */
function timeVi(at: Date): string {
  const vn = new Date(at.getTime() + VN_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())} ${pad(vn.getUTCDate())}/${pad(
    vn.getUTCMonth() + 1,
  )}`;
}

/**
 * Tells the active staff and managers of the shelf warehouse's facility about a new request.
 * Runs on the caller's transaction so the notice commits with the request. No contractId in the
 * data: staff have no customer contract screen to open.
 */
export async function notifyFacilityStaff(
  em: EntityManager,
  notifications: NotificationsService,
  request: PickupRequestView,
  facilityId: string,
): Promise<void> {
  const recipients: { userId: string }[] = await em.query(
    `SELECT DISTINCT "user_id" AS "userId" FROM "user_role_assignments"
      WHERE "role" IN ('FACILITY_STAFF', 'FACILITY_MANAGER') AND "facility_id" = $1
        AND "starts_at" <= now() AND ("ends_at" IS NULL OR "ends_at" > now())`,
    [facilityId],
  );
  await notifications.createForUsers(
    em,
    recipients.map((row) => row.userId),
    {
      type: NotificationType.PICKUP_REQUEST_CREATED,
      title: 'Yêu cầu lấy đồ mới',
      body: `${request.customer.fullName ?? 'Khách'} muốn lấy ${linesSummary(request.lines)} ở kệ ${
        request.shelf.code
      } lúc ${timeVi(new Date(request.requestedFor))}`,
      data: { pickupRequestId: request.id, warehouseId: request.warehouse.id, facilityId },
    },
  );
}

/** Tells the customer the goods are prepared. */
export async function notifyRequestReady(
  em: EntityManager,
  notifications: NotificationsService,
  request: PickupRequestView,
): Promise<void> {
  await notifications.createForUsers(em, [request.customer.id], {
    type: NotificationType.PICKUP_REQUEST_READY,
    title: 'Đồ đã sẵn sàng',
    body: `Đồ bạn yêu cầu lấy ở kệ ${request.shelf.code} đã được chuẩn bị. Đưa mã gửi / lấy đồ cho nhân viên khi tới.`,
    data: { contractId: request.contractId, pickupRequestId: request.id },
  });
}
