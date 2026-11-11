import type { NotificationsService } from '@modules/notifications/notifications.service';
import { type DropOffRequestView, NotificationType } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { findFacilityStaffIds } from '../shelf-storage/facility-staff.query';
import { linesSummary, timeVi } from '../shelf-storage/shelf-rules';

const staffData = (request: DropOffRequestView, facilityId: string) => ({
  dropOffRequestId: request.id,
  warehouseId: request.warehouse.id,
  facilityId,
});

/**
 * Tells the active staff and managers of the shelf warehouse's facility about a new request.
 * Runs on the caller's transaction so the notice commits with the request. No contractId in the
 * data: staff have no customer contract screen to open.
 */
export async function notifyDropOffCreated(
  em: EntityManager,
  notifications: NotificationsService,
  request: DropOffRequestView,
  facilityId: string,
): Promise<void> {
  await notifications.createForUsers(em, await findFacilityStaffIds(em, facilityId), {
    type: NotificationType.DROP_OFF_REQUEST_CREATED,
    title: 'Yêu cầu gửi đồ mới',
    body: `${request.customer.fullName ?? 'Khách'} muốn gửi ${linesSummary(request.lines)} vào kệ ${
      request.shelf.code
    } lúc ${timeVi(new Date(request.requestedFor))}`,
    data: staffData(request, facilityId),
  });
}

/** Tells the customer the branch is ready to receive the goods. */
export async function notifyDropOffConfirmed(
  em: EntityManager,
  notifications: NotificationsService,
  request: DropOffRequestView,
): Promise<void> {
  await notifications.createForUsers(em, [request.customer.id], {
    type: NotificationType.DROP_OFF_REQUEST_CONFIRMED,
    title: 'Kho đã sẵn sàng nhận đồ',
    body: `Kho đã xác nhận yêu cầu gửi đồ vào kệ ${request.shelf.code} lúc ${timeVi(
      new Date(request.requestedFor),
    )}. Đưa mã gửi / lấy đồ cho nhân viên khi tới.`,
    data: { contractId: request.contractId, dropOffRequestId: request.id },
  });
}

/** Tells the facility's staff and managers the customer will not come with these goods. */
export async function notifyDropOffCancelled(
  em: EntityManager,
  notifications: NotificationsService,
  request: DropOffRequestView,
  facilityId: string,
): Promise<void> {
  await notifications.createForUsers(em, await findFacilityStaffIds(em, facilityId), {
    type: NotificationType.DROP_OFF_REQUEST_CANCELLED,
    title: 'Khách hủy yêu cầu gửi đồ',
    body: `${request.customer.fullName ?? 'Khách'} đã hủy yêu cầu gửi ${linesSummary(
      request.lines,
    )} vào kệ ${request.shelf.code} (hẹn ${timeVi(new Date(request.requestedFor))})`,
    data: staffData(request, facilityId),
  });
}
