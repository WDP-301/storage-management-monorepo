import type { NotificationsService } from '@modules/notifications/notifications.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { startOfVietnamDay } from '@shared/utils/calendar.util';
import { type DropOffRequestView, NotificationType, type PickupRequestView } from '@storage/types';
import { DataSource, type EntityManager } from 'typeorm';
import { loadDropOffRequests } from './drop-off-request.read';
import { loadPickupRequests } from './pickup-request.read';
import { type ShelfRequestKind, shelfRequestRecipients } from './shelf-request-assignment';
import { linesSummary, timeVi } from './shelf-rules';

const LOCK_NAME = 'cron_shelf_request_expiry';

const TABLE: Record<ShelfRequestKind, string> = {
  PICKUP: 'pickup_requests',
  DROP_OFF: 'drop_off_requests',
};
const OPEN: Record<ShelfRequestKind, string> = {
  PICKUP: `('PENDING','READY')`,
  DROP_OFF: `('PENDING','CONFIRMED')`,
};
/** The shelf's warehouse decides the facility — same join as the request reads. */
const FACILITY_JOIN = `
  JOIN "contracts" c ON c."id" = r."contract_id"
  JOIN "booking_items" bi ON bi."id" = c."booking_item_id"
  JOIN "storage_units" u ON u."id" = bi."storage_unit_id"
  JOIN "storage_units" w ON w."id" = u."parent_id"`;

export interface ShelfRequestSweepResult {
  expired: number;
}

/**
 * A drop-off or pick-up request whose appointment day passed with the customer never showing
 * would sit open forever — blocking the contract's next request and keeping a staff assignee
 * waiting. The sweep cancels it (no `cancelled_by`: the system did it) and tells both the
 * customer and the branch. Each request expires in its own transaction; one bad row never
 * stalls the run.
 */
@Injectable()
export class ShelfRequestSweepService {
  private readonly logger = new Logger(ShelfRequestSweepService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('25 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handle(): Promise<void> {
    try {
      const result = await this.run(new Date());
      this.logger.log(`Shelf-request sweep: ${result.expired} expired`);
    } catch (err: any) {
      this.logger.error(`Failed in shelf-request sweep: ${err?.message || err}`, err?.stack);
    }
  }

  async run(now: Date): Promise<ShelfRequestSweepResult> {
    const result: ShelfRequestSweepResult = { expired: 0 };
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const lock = (await runner.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`, [
        LOCK_NAME,
      ])) as Array<{ acquired: boolean }>;
      if (!lock?.[0]?.acquired) return result;

      const cutoff = startOfVietnamDay(now);
      const candidates: { kind: ShelfRequestKind; id: string }[] = [];
      for (const kind of ['PICKUP', 'DROP_OFF'] as const) {
        const rows: { id: string }[] = await runner.manager.query(
          `SELECT r."id" FROM "${TABLE[kind]}" r
            WHERE r."status" IN ${OPEN[kind]} AND r."requested_for" < $1`,
          [cutoff],
        );
        candidates.push(...rows.map((row) => ({ kind, id: row.id })));
      }

      for (const candidate of candidates) {
        try {
          const expired = await this.dataSource.transaction((em) =>
            this.expireOne(em, candidate.kind, candidate.id, cutoff),
          );
          if (expired) result.expired += 1;
        } catch (err: any) {
          this.logger.error(
            `Shelf-request sweep failed for ${candidate.kind} ${candidate.id}: ${err?.message || err}`,
            err?.stack,
          );
        }
      }
      return result;
    } finally {
      try {
        await runner.query(`SELECT pg_advisory_unlock(hashtext($1))`, [LOCK_NAME]);
      } finally {
        await runner.release();
      }
    }
  }

  /** Cancels one still-open, still-expired request under its row lock; notifies both sides. */
  private async expireOne(
    em: EntityManager,
    kind: ShelfRequestKind,
    id: string,
    cutoff: Date,
  ): Promise<boolean> {
    const [expired]: { id: string }[] = await em.query(
      `UPDATE "${TABLE[kind]}" r
          SET "status" = 'CANCELLED', "cancelled_at" = now(), "updated_at" = now()
        WHERE r."id" = $1 AND r."status" IN ${OPEN[kind]} AND r."requested_for" < $2
        RETURNING r."id"`,
      [id, cutoff],
    );
    if (!expired) return false; // Served, completed or cancelled by hand meanwhile.
    const [facility]: { facilityId: string | null }[] = await em.query(
      `SELECT w."facility_id" AS "facilityId" FROM "${TABLE[kind]}" r ${FACILITY_JOIN}
        WHERE r."id" = $1`,
      [id],
    );

    if (kind === 'PICKUP') {
      const [request] = await loadPickupRequests(em, { ids: [id], order: 'newest' });
      if (request) await this.notifyExpired(em, 'PICKUP', request, facility?.facilityId ?? null);
    } else {
      const [request] = await loadDropOffRequests(em, { ids: [id], order: 'newest' });
      if (request) await this.notifyExpired(em, 'DROP_OFF', request, facility?.facilityId ?? null);
    }
    return true;
  }

  private async notifyExpired(
    em: EntityManager,
    kind: ShelfRequestKind,
    request: PickupRequestView | DropOffRequestView,
    facilityId: string | null,
  ): Promise<void> {
    const isPickup = kind === 'PICKUP';
    const at = timeVi(new Date(request.requestedFor));
    const summary = linesSummary(request.lines as never);
    if (isPickup) {
      await this.notifications.createForUsers(em, [request.customer.id], {
        type: NotificationType.PICKUP_REQUEST_CANCELLED,
        title: 'Yêu cầu lấy đồ đã quá hạn',
        body: `Yêu cầu lấy ${summary} ở kệ ${request.shelf.code} lúc ${at} đã quá hạn và tự động hủy — đặt lại nếu bạn vẫn cần lấy đồ.`,
        data: { contractId: request.contractId, pickupRequestId: request.id },
      });
    } else {
      await this.notifications.createForUsers(em, [request.customer.id], {
        type: NotificationType.DROP_OFF_REQUEST_CANCELLED,
        title: 'Yêu cầu gửi đồ đã quá hạn',
        body: `Yêu cầu gửi ${summary} vào kệ ${request.shelf.code} lúc ${at} đã quá hạn và tự động hủy — đặt lại nếu bạn vẫn muốn gửi đồ.`,
        data: { contractId: request.contractId, dropOffRequestId: request.id },
      });
    }
    if (!facilityId) return;
    const recipients = await shelfRequestRecipients(em, facilityId, request.assignedTo?.id ?? null);
    await this.notifications.createForUsers(em, recipients, {
      type: isPickup
        ? NotificationType.PICKUP_REQUEST_CANCELLED
        : NotificationType.DROP_OFF_REQUEST_CANCELLED,
      title: isPickup ? 'Yêu cầu lấy đồ quá hạn' : 'Yêu cầu gửi đồ quá hạn',
      body: `Yêu cầu của ${request.customer.fullName ?? 'khách'} (hẹn ${at}) đã quá hạn và bị hệ thống hủy.`,
      data: isPickup
        ? { pickupRequestId: request.id, warehouseId: request.warehouse.id, facilityId }
        : { dropOffRequestId: request.id, warehouseId: request.warehouse.id, facilityId },
    });
  }
}
