import { createHash } from 'node:crypto';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Booking } from '@modules/bookings/entities/booking.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { HttpStatus, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { BookingStatus, HoldStatus, StorageUnitStatus } from '@storage/types';
import { DataSource, In, LessThan, Not, Repository } from 'typeorm';
import { CreateBookingDto } from './dto/booking.dto';
import { BookingItem } from './entities/booking-item.entity';
import { IdempotencyKey, IdempotencyStatus } from './entities/idempotency-key.entity';
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
  ): Promise<Record<string, unknown>> {
    const requestHash = hashBody(dto as unknown as Record<string, unknown>);

    // ── 1. Idempotency check — 1 query via xmax trick ──────────────────────
    // Raw SQL returns snake_case column names from Postgres
    type IdemRow = {
      key: string;
      user_id: string;
      status: IdempotencyStatus;
      request_hash: string;
      response_status: number | null;
      response_body: Record<string, unknown> | null;
      expires_at: string;
      is_new_insert: boolean;
    };

    const [idem] = await this.idempotencyRepo.query<IdemRow[]>(
      `INSERT INTO idempotency_keys (key, user_id, status, request_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '${IDEMPOTENCY_TTL_HOURS} hours')
       ON CONFLICT (key, user_id) DO UPDATE
         SET expires_at = idempotency_keys.expires_at
       RETURNING *, (xmax = 0) AS is_new_insert`,
      [idempotencyKey, user.id, IdempotencyStatus.PROCESSING, requestHash],
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
        return (idem.response_body ?? {}) as Record<string, unknown>;
      }
      // status = PROCESSING → another request is in-flight
      throw new DomainException(
        ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
        'Request khác đang xử lý với cùng idempotency key, vui lòng thử lại sau',
        HttpStatus.CONFLICT,
      );
    }

    const unitIds = dto.items.map((i) => i.storageUnitId);
    const uniqueUnitIds = new Set(unitIds);
    if (uniqueUnitIds.size !== unitIds.length) {
      await this.deleteIdempotencyKey(idempotencyKey, user.id);
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Không được chứa storage unit trùng lặp trong cùng một booking',
        HttpStatus.BAD_REQUEST,
      );
    }

    // ── 2. Pre-check — outside TX, no lock ─────────────────────────────────
    const preCheckUnits = await this.dataSource
      .getRepository(StorageUnit)
      .find({ where: { id: In(unitIds) }, relations: ['unitType'] });

    if (preCheckUnits.length !== unitIds.length) {
      await this.deleteIdempotencyKey(idempotencyKey, user.id);
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
      await this.deleteIdempotencyKey(idempotencyKey, user.id);
      throw new DomainException(
        ErrorCode.UNIT_NOT_AVAILABLE,
        'Một hoặc nhiều storage unit không còn available',
        HttpStatus.CONFLICT,
        { unavailableUnitIds: preCheckUnavailable.map((u) => u.id) },
      );
    }

    // ── 3. Transaction — SELECT FOR UPDATE + create booking ────────────────
    try {
      const responseBody = await this.dataSource.transaction(async (em) => {
        // Lock rows for this transaction
        const units = await em
          .getRepository(StorageUnit)
          .createQueryBuilder('unit')
          .innerJoinAndSelect('unit.unitType', 'unitType')
          .whereInIds(unitIds)
          .setLock('pessimistic_write', undefined, ['unit'])
          .getMany();

        // "Second" availability check inside the lock
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

        // Calculate totals from individual item schedules & unit types
        let subtotal = 0;
        let depositTotal = 0;
        for (const item of dto.items) {
          const unit = unitMap.get(item.storageUnitId);
          if (!unit) continue;
          const monthly = Number(unit.unitType.monthlyPrice);
          const depositMonths = Number(unit.unitType.defaultDepositMonths);
          subtotal += monthly * item.rentalMonths;
          depositTotal += monthly * depositMonths;
        }

        // Create booking
        const booking = em.create(Booking, {
          bookingNo: generateBookingNo(),
          customerId: user.id,
          status: BookingStatus.HOLDING,
          subtotal,
          depositTotal,
        });
        await em.save(Booking, booking);

        const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

        // Create booking items + unit holds + lock units
        for (const item of dto.items) {
          const unit = unitMap.get(item.storageUnitId);
          if (!unit) continue;
          const monthly = Number(unit.unitType.monthlyPrice);
          const depositMonths = Number(unit.unitType.defaultDepositMonths);

          await em.save(BookingItem, {
            bookingId: booking.id,
            storageUnitId: unit.id,
            requestedStartAt: new Date(item.requestedStartAt),
            rentalMonths: item.rentalMonths,
            monthlyPriceSnapshot: monthly,
            depositSnapshot: monthly * depositMonths,
          });

          await em.save(UnitHold, {
            bookingId: booking.id,
            storageUnitId: unit.id,
            status: HoldStatus.ACTIVE,
            expiresAt,
          });

          await em.update(StorageUnit, unit.id, { status: StorageUnitStatus.HELD });
        }

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

      return responseBody;
    } catch (err) {
      // If it's our own DomainException from inside the TX, clean up the key so client can retry
      if (err instanceof DomainException) {
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
  // Confirm / Cancel (placeholder — payment task)
  // ---------------------------------------------------------------------------

  async confirm(_id: string, _user: AuthUser): Promise<{ message: string }> {
    return { message: 'Booking confirm — not yet implemented' };
  }

  async cancel(_id: string, _user: AuthUser): Promise<{ message: string }> {
    return { message: 'Booking cancel — not yet implemented' };
  }

  // ---------------------------------------------------------------------------
  // Cron: release expired holds
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredHolds(): Promise<void> {
    const now = new Date();
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
            await em.update(UnitHold, hold.id, {
              status: HoldStatus.EXPIRED,
              releasedAt: now,
            });

            await em.update(StorageUnit, hold.storageUnitId, {
              status: StorageUnitStatus.AVAILABLE,
            });

            // Expire the booking only if this was its last active hold
            const remainingActiveHolds = await em.getRepository(UnitHold).count({
              where: {
                bookingId: hold.bookingId,
                status: HoldStatus.ACTIVE,
                id: Not(hold.id),
              },
            });

            if (remainingActiveHolds === 0) {
              await em.update(Booking, hold.bookingId, { status: BookingStatus.EXPIRED });
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
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async deleteIdempotencyKey(key: string, userId: string): Promise<void> {
    await this.idempotencyRepo.delete({ key, userId });
  }
}
