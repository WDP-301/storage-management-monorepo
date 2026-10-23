import type { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType, UserRole } from '@storage/types';
import type { EntityManager } from 'typeorm';

type ClosedVisitRow = {
  id: string;
  facilityId: string;
  customerName: string | null;
  warehouseCode: string | null;
  usedAt: Date;
};

/** `15:34 ngày 22/10` in Vietnam time, without Intl so the output is fixed across runtimes. */
function timeVi(at: Date): string {
  const vn = new Date(at.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())} ngày ${pad(vn.getUTCDate())}/${pad(
    vn.getUTCMonth() + 1,
  )}`;
}

/**
 * Tells the active facility managers of each visit's facility that it was closed without an exit
 * scan. Runs on the caller's transaction so the notice and the close commit together.
 */
export async function notifyMissedCheckOuts(
  em: EntityManager,
  notifications: NotificationsService,
  visitIds: readonly string[],
): Promise<void> {
  if (visitIds.length === 0) return;
  const visits: ClosedVisitRow[] = await em.query(
    `SELECT e."id", e."facility_id" AS "facilityId", cu."full_name" AS "customerName",
            w."code" AS "warehouseCode", e."used_at" AS "usedAt"
       FROM "access_events" e
       JOIN "app_users" cu ON cu."id" = e."customer_id"
       LEFT JOIN "storage_units" w ON w."id" = e."warehouse_id"
      WHERE e."id" = ANY($1::uuid[])`,
    [visitIds],
  );
  const facilityIds = [...new Set(visits.map((visit) => visit.facilityId))];
  const managers: { userId: string; facilityId: string }[] = await em.query(
    `SELECT "user_id" AS "userId", "facility_id" AS "facilityId"
       FROM "user_role_assignments"
      WHERE "role" = $1 AND "facility_id" = ANY($2::uuid[])
        AND "starts_at" <= now() AND ("ends_at" IS NULL OR "ends_at" > now())`,
    [UserRole.FACILITY_MANAGER, facilityIds],
  );

  for (const visit of visits) {
    const recipients = managers.filter((m) => m.facilityId === visit.facilityId);
    await notifications.createForUsers(
      em,
      recipients.map((m) => m.userId),
      {
        type: NotificationType.CHECK_OUT_MISSED,
        title: 'Khách chưa check-out',
        body: `${visit.customerName ?? 'Khách'} vào kho ${visit.warehouseCode ?? ''} lúc ${timeVi(
          new Date(visit.usedAt),
        )} nhưng chưa check-out. Hệ thống đã tự đóng lượt.`,
        data: { visitId: visit.id, facilityId: visit.facilityId },
      },
    );
  }
}
