import type { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType, type PickupRequestView } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { findFacilityStaffIds } from '../shelf-storage/facility-staff.query';
import { linesSummary, timeVi } from '../shelf-storage/shelf-rules';

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
  await notifications.createForUsers(em, await findFacilityStaffIds(em, facilityId), {
    type: NotificationType.PICKUP_REQUEST_CREATED,
    title: 'Yêu cầu lấy đồ mới',
    body: `${request.customer.fullName ?? 'Khách'} muốn lấy ${linesSummary(request.lines)} ở kệ ${
      request.shelf.code
    } lúc ${timeVi(new Date(request.requestedFor))}`,
    data: { pickupRequestId: request.id, warehouseId: request.warehouse.id, facilityId },
  });
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

/** Tells the facility's staff and managers the customer no longer needs the goods prepared. */
export async function notifyRequestCancelled(
  em: EntityManager,
  notifications: NotificationsService,
  request: PickupRequestView,
  facilityId: string,
): Promise<void> {
  await notifications.createForUsers(em, await findFacilityStaffIds(em, facilityId), {
    type: NotificationType.PICKUP_REQUEST_CANCELLED,
    title: 'Khách hủy yêu cầu lấy đồ',
    body: `${request.customer.fullName ?? 'Khách'} đã hủy yêu cầu lấy ${linesSummary(
      request.lines,
    )} ở kệ ${request.shelf.code} (hẹn ${timeVi(new Date(request.requestedFor))})`,
    data: { pickupRequestId: request.id, warehouseId: request.warehouse.id, facilityId },
  });
}
