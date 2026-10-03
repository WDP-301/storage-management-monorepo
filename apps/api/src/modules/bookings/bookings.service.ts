import { createHash } from 'node:crypto';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Booking } from '@modules/bookings/entities/booking.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { HttpStatus, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { BookingStatus, HoldStatus, IdempotencyStatus, StorageUnitStatus } from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, DeepPartial, In, LessThan, Not, QueryFailedError, Repository } from 'typeorm';
import { CreateBookingDto } from './dto/booking.dto';
import { BookingItem } from './entities/booking-item.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { UnitHold } from './entities/unit-hold.entity';

const HOLD_MINUTES = 15;
const IDEMPOTENCY_TTL_HOURS = 24;

/** Generate a booking number: BK-<timestamp-ms>-<4 random hex chars> */
function generateBookingNo(): string {
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `BK-${Date.now()}-${rand}`;
}

/** Recursively serializes an object with sorted keys (Canonical JSON). */
function canonicalStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map((item) => (item === undefined ? 'null' : canonicalStringify(item))).join(',')}]`;
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

/** SHA-256 hex of a deterministic canonical JSON representation of the request body. */
function hashBody(body: Record<string, unknown>): string {
  const normalized = { ...body };
  if (Array.isArray(normalized.items)) {
    normalized.items = [...(normalized.items as Array<Record<string, unknown>>)].sort((a, b) =>
      String(a?.storageUnitId ?? '').localeCompare(String(b?.storageUnitId ?? '')),
    );
  }
  const stable = canonicalStringify(normalized);
  return createHash('sha256').update(stable).digest('hex');
}

@Injectable()
export class BookingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepo: Repository<IdempotencyKey>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Release any holds that expired while the server was down. */
  async onApplicationBootstrap(): Promise<void> {
    await this.releaseExpiredHolds();
  }

  // ---------------------------------------------------------------------------
  // Create booking
  // ---------------------------------------------------------------------------

  async create(
    dto: CreateBookingDto,
    user: AuthUser,
    idempotencyKey: string,
  ): Promise<{ data: Record<string, unknown>; isRetry: boolean }> {
    const requestHash = hashBody(dto as unknown as Record<string, unknown>);

    // ── 1. Idempotency check via atomic INSERT ON CONFLICT ─────────────────
    type IdemRow = {
      key: string;
      user_id: string;
      status: IdempotencyStatus;
      request_hash: string;
      response_status: number | null;
      response_body: Record<string, unknown> | null;
      created_at: string;
      expires_at: string;
      is_new_insert: boolean;
    };

    let [idem] = await this.idempotencyRepo.query<IdemRow[]>(
      `INSERT INTO idempotency_keys (key, user_id, status, request_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))
       ON CONFLICT (key, user_id) DO UPDATE
         SET expires_at = idempotency_keys.expires_at
       RETURNING *, (xmax = 0) AS is_new_insert`,
      [idempotencyKey, user.id, IdempotencyStatus.PROCESSING, requestHash, IDEMPOTENCY_TTL_HOURS],
    );

    if (!idem.is_new_insert) {
      // Retry path — compare snake_case fields from raw SQL result
      if (idem.request_hash !== requestHash) {
        throw new DomainException(
          ErrorCode.IDEMPOTENCY_PAYLOAD_MISMATCH,
          'Idempotency key đã được dùng với payload khác',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (idem.status === IdempotencyStatus.DONE) {
        // Cache hit — return stored response directly
        return {
          data: (idem.response_body ?? {}) as Record<string, unknown>,
          isRetry: true,
        };
      }

      // If status = PROCESSING, check if it timed out (> 60 seconds ago from a crashed instance)
      const createdAtMs = new Date(idem.created_at).getTime();
      const isStale = Date.now() - createdAtMs > 60 * 1000;
      if (!isStale) {
        throw new DomainException(
          ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
          'Request khác đang xử lý với cùng idempotency key, vui lòng thử lại sau',
          HttpStatus.CONFLICT,
        );
      }

      this.logger.warn(
        `Idempotency key ${idempotencyKey} was stuck in PROCESSING for user ${user.id}. Re-claiming stale key.`,
      );

      // Reclaim stale key atomically: only one request matching PROCESSING and stale will succeed
      const updatedRows = await this.idempotencyRepo.query<IdemRow[]>(
        `UPDATE idempotency_keys
         SET created_at = now(),
             request_hash = $1,
             expires_at = now() + make_interval(hours => $2)
         WHERE key = $3
           AND user_id = $4
           AND status = $5
           AND created_at <= now() - interval '60 seconds'
         RETURNING *, true AS is_new_insert`,
        [requestHash, IDEMPOTENCY_TTL_HOURS, idempotencyKey, user.id, IdempotencyStatus.PROCESSING],
      );

      if (!updatedRows || updatedRows.length === 0) {
        throw new DomainException(
          ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
          'Request khác đang xử lý với cùng idempotency key, vui lòng thử lại sau',
          HttpStatus.CONFLICT,
        );
      }
      idem = updatedRows[0];
    }

    let isCommitted = false;
    try {
      // ── 2. Pre-check — outside TX, no lock (fast path) ─────────────────────
      const unitIds = dto.items.map((i) => i.storageUnitId);
      const preCheckUnits = await this.dataSource.getRepository(StorageUnit).find({
        where: { id: In(unitIds) },
        select: ['id', 'status'],
      });

      if (preCheckUnits.length !== unitIds.length) {
        throw new DomainException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Một hoặc nhiều storage unit không tồn tại',
          HttpStatus.NOT_FOUND,
        );
      }

      const preCheckUnavailable = preCheckUnits.filter(
        (u) => u.status !== StorageUnitStatus.AVAILABLE,
      );
      if (preCheckUnavailable.length > 0) {
        throw new DomainException(
          ErrorCode.UNIT_NOT_AVAILABLE,
          'Một hoặc nhiều storage unit không còn available',
          HttpStatus.CONFLICT,
          { unavailableUnitIds: preCheckUnavailable.map((u) => u.id) },
        );
      }

      // ── 3. Transaction — Deterministic SELECT FOR UPDATE + create booking ──
      const sortedUnitIds = [...unitIds].sort();

      const responseBody = await this.dataSource.transaction(async (em) => {
        // Lock rows in deterministic ascending ID order to prevent PostgreSQL deadlocks (40P01)
        const units = await em
          .getRepository(StorageUnit)
          .createQueryBuilder('unit')
          .innerJoinAndSelect('unit.unitType', 'unitType')
          .whereInIds(sortedUnitIds)
          .orderBy('unit.id', 'ASC')
          .setLock('pessimistic_write', undefined, ['unit'])
          .getMany();

        // Verify count inside the lock to ensure no unit was deleted between pre-check and lock
        if (units.length !== sortedUnitIds.length) {
          throw new DomainException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Một hoặc nhiều storage unit không còn tồn tại',
            HttpStatus.NOT_FOUND,
          );
        }

        // Second availability check inside the lock
        const stillUnavailable = units.filter((u) => u.status !== StorageUnitStatus.AVAILABLE);
        if (stillUnavailable.length > 0) {
          throw new DomainException(
            ErrorCode.UNIT_NOT_AVAILABLE,
            'Một hoặc nhiều storage unit không còn available',
            HttpStatus.CONFLICT,
            { unavailableUnitIds: stillUnavailable.map((u) => u.id) },
          );
        }

        const unitMap = new Map(units.map((u) => [u.id, u]));

        // Resolve per-item pricing in a single pass & accumulate totals using Decimal.js
        let subtotalDec = new Decimal(0);
        let depositTotalDec = new Decimal(0);

        const resolvedItems = dto.items.map((item) => {
          const unit = unitMap.get(item.storageUnitId);
          if (!unit) {
            throw new DomainException(
              ErrorCode.RESOURCE_NOT_FOUND,
              `Storage unit ${item.storageUnitId} không tìm thấy`,
              HttpStatus.NOT_FOUND,
            );
          }
          if (unit.unitType?.monthlyPrice == null) {
            throw new DomainException(
              ErrorCode.INTERNAL_ERROR,
              `Storage unit ${item.storageUnitId} thiếu cấu hình monthlyPrice`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }

          const monthlyDec = new Decimal(unit.unitType.monthlyPrice);
          const depositMonthsDec = new Decimal(unit.unitType.defaultDepositMonths ?? 1);
          const depositSnapshot = monthlyDec.times(depositMonthsDec).toFixed(2);
          const monthlyPriceSnapshot = monthlyDec.toFixed(2);

          subtotalDec = subtotalDec.plus(monthlyDec.times(item.rentalMonths));
          depositTotalDec = depositTotalDec.plus(monthlyDec.times(depositMonthsDec));

          return {
            storageUnitId: unit.id,
            requestedStartAt: new Date(item.requestedStartAt),
            rentalMonths: item.rentalMonths,
            monthlyPriceSnapshot: monthlyPriceSnapshot as unknown as number,
            depositSnapshot: depositSnapshot as unknown as number,
          };
        });

        const subtotal = subtotalDec.toFixed(2);
        const depositTotal = depositTotalDec.toFixed(2);

        // Create booking
        const booking = em.create(Booking, {
          bookingNo: generateBookingNo(),
          customerId: user.id,
          status: BookingStatus.HOLDING,
          subtotal: subtotal as unknown as number,
          depositTotal: depositTotal as unknown as number,
        });
        await em.save(Booking, booking);

        const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

        // Check if any unit currently has an active, unexpired hold
        const activeUnexpiredHold = await em
          .getRepository(UnitHold)
          .createQueryBuilder('hold')
          .where('hold.storageUnitId IN (:...unitIds)', { unitIds: sortedUnitIds })
          .andWhere('hold.status = :status', { status: HoldStatus.ACTIVE })
          .andWhere('hold.expiresAt > now()')
          .getOne();

        if (activeUnexpiredHold) {
          throw new DomainException(
            ErrorCode.UNIT_NOT_AVAILABLE,
            'Một hoặc nhiều storage unit đang được giữ chỗ',
            HttpStatus.CONFLICT,
            { unavailableUnitIds: [activeUnexpiredHold.storageUnitId] },
          );
        }

        // Expire any stale ACTIVE holds so they don't block insertion or violate UQ_active_unit_hold
        await em
          .createQueryBuilder()
          .update(UnitHold)
          .set({ status: HoldStatus.EXPIRED })
          .where('storageUnitId IN (:...unitIds)', { unitIds: sortedUnitIds })
          .andWhere('status = :status', { status: HoldStatus.ACTIVE })
          .andWhere('expiresAt <= now()')
          .execute();

        // Bulk insert booking items & unit holds reusing resolved items
        const bookingItemsToSave: DeepPartial<BookingItem>[] = resolvedItems.map((r) => ({
          bookingId: booking.id,
          storageUnitId: r.storageUnitId,
          requestedStartAt: r.requestedStartAt,
          rentalMonths: r.rentalMonths,
          monthlyPriceSnapshot: r.monthlyPriceSnapshot,
          depositSnapshot: r.depositSnapshot,
        }));

        const unitHoldsToSave: DeepPartial<UnitHold>[] = resolvedItems.map((r) => ({
          bookingId: booking.id,
          storageUnitId: r.storageUnitId,
          status: HoldStatus.ACTIVE,
          expiresAt,
        }));

        await em.save(BookingItem, bookingItemsToSave);

        try {
          await em.save(UnitHold, unitHoldsToSave);
        } catch (err: unknown) {
          if (
            err instanceof QueryFailedError &&
            (err as { driverError?: { code?: string } }).driverError?.code === '23505'
          ) {
            throw new DomainException(
              ErrorCode.UNIT_NOT_AVAILABLE,
              'Một hoặc nhiều storage unit không còn available',
              HttpStatus.CONFLICT,
              { unavailableUnitIds: sortedUnitIds },
            );
          }
          throw err;
        }

        // Update units to HELD only if still AVAILABLE
        await em.update(
          StorageUnit,
          { id: In(sortedUnitIds), status: StorageUnitStatus.AVAILABLE },
          { status: StorageUnitStatus.HELD },
        );

        // Mark idempotency key as DONE with cached response
        const body = {
          id: booking.id,
          bookingNo: booking.bookingNo,
          status: booking.status,
          subtotal: booking.subtotal,
          depositTotal: booking.depositTotal,
          expiresAt,
          items: dto.items.map((item) => ({
            storageUnitId: item.storageUnitId,
            requestedStartAt: item.requestedStartAt,
            rentalMonths: item.rentalMonths,
          })),
        };

        await em.update(
          IdempotencyKey,
          { key: idempotencyKey, userId: user.id },
          {
            status: IdempotencyStatus.DONE,
            responseStatus: HttpStatus.CREATED,
            responseBody: body,
          },
        );

        return body;
      });

      isCommitted = true;
      return { data: responseBody, isRetry: false };
    } catch (err) {
      // Clean up idempotency key if any error occurred before transaction commit
      if (!isCommitted) {
        await this.deleteIdempotencyKey(idempotencyKey, user.id);
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findByCustomer(userId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { customerId: userId },
      relations: ['items', 'items.storageUnit'],
      order: { createdAt: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------------
  // Confirm / Cancel
  // ---------------------------------------------------------------------------

  async confirm(id: string, user: AuthUser): Promise<{ message: string }> {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Booking không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    if (booking.customerId !== user.id) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Bạn không có quyền thao tác trên booking này',
        HttpStatus.FORBIDDEN,
      );
    }
    return { message: 'Booking confirm — not yet implemented' };
  }

  async cancel(id: string, user: AuthUser): Promise<{ message: string }> {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Booking không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    if (booking.customerId !== user.id) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Bạn không có quyền thao tác trên booking này',
        HttpStatus.FORBIDDEN,
      );
    }
    return { message: 'Booking cancel — not yet implemented' };
  }

  // ---------------------------------------------------------------------------
  // Cron: release expired holds
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredHolds(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();

    // Distributed single-run lock via PostgreSQL advisory lock
    const rows = (await runner.query(
      `SELECT pg_try_advisory_lock(hashtext('cron_release_expired_holds')) AS acquired`,
    )) as Array<{ acquired: boolean }>;
    const acquired = Boolean(rows?.[0]?.acquired);

    if (!acquired) {
      this.logger.debug(
        '[CronJob:releaseExpiredHolds] Another instance is currently executing releaseExpiredHolds. Skipping.',
      );
      await runner.release();
      return;
    }

    const now = new Date();

    try {
      this.logger.log(
        `[CronJob:releaseExpiredHolds] Running check at ${now.toLocaleTimeString('vi-VN')} (${now.toISOString()})...`,
      );

      const expiredHolds = await this.dataSource.getRepository(UnitHold).find({
        where: { status: HoldStatus.ACTIVE, expiresAt: LessThan(now) },
      });

      if (expiredHolds.length === 0) {
        this.logger.log('[CronJob:releaseExpiredHolds] 0 expired holds found.');
      } else {
        this.logger.log(
          `[CronJob:releaseExpiredHolds] Releasing ${expiredHolds.length} expired unit hold(s)...`,
        );

        for (const hold of expiredHolds) {
          try {
            await this.dataSource.transaction(async (em) => {
              // Update hold only if still ACTIVE
              const holdUpdate = await em.update(
                UnitHold,
                { id: hold.id, status: HoldStatus.ACTIVE },
                {
                  status: HoldStatus.EXPIRED,
                  releasedAt: now,
                },
              );

              if (!holdUpdate.affected || holdUpdate.affected === 0) {
                return; // Already released or handled
              }

              // Update storage unit only if still HELD (avoid overwriting RENTED/OCCUPIED)
              await em.update(
                StorageUnit,
                { id: hold.storageUnitId, status: StorageUnitStatus.HELD },
                { status: StorageUnitStatus.AVAILABLE },
              );

              // Expire the booking only if this was its last active hold and it is still HOLDING
              const remainingActiveHolds = await em.getRepository(UnitHold).count({
                where: {
                  bookingId: hold.bookingId,
                  status: HoldStatus.ACTIVE,
                  id: Not(hold.id),
                },
              });

              if (remainingActiveHolds === 0) {
                await em.update(
                  Booking,
                  { id: hold.bookingId, status: BookingStatus.HOLDING },
                  { status: BookingStatus.EXPIRED },
                );
              }
            });
            this.logger.log(
              `[CronJob:releaseExpiredHolds] Successfully released hold ${hold.id} for unit ${hold.storageUnitId}`,
            );
          } catch (err) {
            this.logger.error(
              `[CronJob:releaseExpiredHolds] Failed to release hold ${hold.id}: ${(err as Error).message}`,
            );
          }
        }
      }

      // Clean up expired idempotency keys
      const deleteResult = await this.idempotencyRepo.delete({ expiresAt: LessThan(now) });
      if (deleteResult.affected && deleteResult.affected > 0) {
        this.logger.log(
          `[CronJob:releaseExpiredHolds] Cleaned up ${deleteResult.affected} expired idempotency key(s)`,
        );
      }
    } finally {
      try {
        await runner.query(`SELECT pg_advisory_unlock(hashtext('cron_release_expired_holds'))`);
      } finally {
        await runner.release();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async deleteIdempotencyKey(key: string, userId: string): Promise<void> {
    await this.idempotencyRepo.delete({
      key,
      userId,
      status: IdempotencyStatus.PROCESSING,
    });
  }
}
