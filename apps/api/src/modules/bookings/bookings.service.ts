import { createHash } from 'node:crypto';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { IdempotencyKey } from '@entities/idempotency-key.entity';
import { Payment } from '@entities/payment.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { generatePaymentNo } from '@modules/payments/payment-no.util';
import { PAYMENT_EVENTS, PaymentReceivedEvent } from '@modules/payments/types/payment';
import { buildVietQrUrl } from '@modules/payments/vietqr.util';
import { HttpStatus, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ENV_KEY } from '@shared/constants';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import {
  BookingStatus,
  HoldStatus,
  IdempotencyStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  StorageUnitStatus,
} from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, DeepPartial, In, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { extractBookingNos, generateBookingNo } from './booking-no.util';
import { BookingResponseDto, CreateBookingDto } from './dto/booking.dto';

const HOLD_MINUTES = 15;
const IDEMPOTENCY_TTL_HOURS = 24;
const STATUSES_AWAITING_DEPOSIT: BookingStatus[] = [
  BookingStatus.HOLDING,
  BookingStatus.PENDING_DEPOSIT,
];

/** Rolls the confirm transaction back when the transfer arrived after the holds expired. */
class LatePaymentError extends Error {}

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
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Release any holds that expired while the server was down. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.paymentQrConfigured()) {
      this.logger.warn('SEPAY_BANK_ID/SEPAY_ACCOUNT_NO/SEPAY_ACCOUNT_NAME not set — no payment QR');
    }
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
          if (isUniqueViolation(err)) {
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
          paymentQrUrl: this.buildPaymentQrUrl(booking.bookingNo, depositTotal),
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

  async findByCustomer(userId: string): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingRepo.find({
      where: { customerId: userId },
      relations: ['items', 'items.storageUnit'],
      order: { createdAt: 'DESC' },
    });
    if (bookings.length === 0) return [];

    // Thời điểm hết hạn nằm trên unit_holds — lấy MAX expiresAt của các hold còn ACTIVE
    const activeHolds = await this.dataSource.getRepository(UnitHold).find({
      where: {
        bookingId: In(bookings.map((b) => b.id)),
        status: HoldStatus.ACTIVE,
      },
      select: ['bookingId', 'expiresAt'],
    });
    const expiresByBooking = new Map<string, Date>();
    for (const hold of activeHolds) {
      const current = expiresByBooking.get(hold.bookingId);
      if (!current || hold.expiresAt > current) {
        expiresByBooking.set(hold.bookingId, hold.expiresAt);
      }
    }

    return bookings.map((b) => this.toBookingResponse(b, expiresByBooking.get(b.id) ?? null));
  }

  async findById(id: string, user: AuthUser): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['items', 'items.storageUnit'],
    });
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
        'Bạn không có quyền xem booking này',
        HttpStatus.FORBIDDEN,
      );
    }

    const activeHolds = await this.dataSource.getRepository(UnitHold).find({
      where: { bookingId: booking.id, status: HoldStatus.ACTIVE },
      select: ['expiresAt'],
    });
    const holdExpiresAt = activeHolds.reduce<Date | null>(
      (max, h) => (!max || h.expiresAt > max ? h.expiresAt : max),
      null,
    );

    return this.toBookingResponse(booking, holdExpiresAt);
  }

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------

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

  /**
   * Shapes a booking for API responses: payment QR only while the booking still awaits its
   * deposit and a live hold backs it, null afterwards so clients can stop polling.
   */
  private toBookingResponse(b: Booking, holdExpiresAt: Date | null): BookingResponseDto {
    const stillPayable =
      STATUSES_AWAITING_DEPOSIT.includes(b.status) &&
      holdExpiresAt !== null &&
      holdExpiresAt > new Date();
    return {
      ...b,
      holdExpiresAt,
      paymentQrUrl: stillPayable
        ? this.buildPaymentQrUrl(b.bookingNo, String(b.depositTotal))
        : null,
    } as BookingResponseDto;
  }

  /**
   * Deposit QR (VietQR) for the mobile app to render — `addInfo` carries the booking number so
   * the SePay webhook can match the transfer. Null when the bank account env is not configured.
   */
  private buildPaymentQrUrl(bookingNo: string, depositTotal: string): string | null {
    if (!this.paymentQrConfigured()) return null;
    return buildVietQrUrl({
      bankId: this.configService.get<string>(ENV_KEY.SEPAY_BANK_ID) as string,
      accountNo: this.configService.get<string>(ENV_KEY.SEPAY_ACCOUNT_NO) as string,
      accountName: this.configService.get<string>(ENV_KEY.SEPAY_ACCOUNT_NAME) as string,
      amount: new Decimal(depositTotal).toFixed(0),
      addInfo: bookingNo,
    });
  }

  private paymentQrConfigured(): boolean {
    return Boolean(
      this.configService.get<string>(ENV_KEY.SEPAY_BANK_ID) &&
        this.configService.get<string>(ENV_KEY.SEPAY_ACCOUNT_NO) &&
        this.configService.get<string>(ENV_KEY.SEPAY_ACCOUNT_NAME),
    );
  }

  private async deleteIdempotencyKey(key: string, userId: string): Promise<void> {
    await this.idempotencyRepo.delete({
      key,
      userId,
      status: IdempotencyStatus.PROCESSING,
    });
  }

  // ---------------------------------------------------------------------------
  // Payment listener
  // ---------------------------------------------------------------------------

  @OnEvent(PAYMENT_EVENTS.RECEIVED, { async: true })
  async handlePaymentReceived(event: PaymentReceivedEvent): Promise<void> {
    // Customers put their booking number in the transfer content; SePay `code` is not used.
    const candidates = extractBookingNos(event.content);

    if (candidates.length === 0) {
      this.logger.log(
        `Payment sepayId=${event.sepayId} has no booking number in content="${event.content}", skipping`,
      );
      return;
    }

    const bookings = await this.bookingRepo.find({
      where: { bookingNo: In(candidates) },
    });

    if (bookings.length === 0) {
      this.logger.log(
        `No booking found for candidates=[${candidates.join(', ')}] (sepayId=${event.sepayId})`,
      );
      return;
    }

    // One transfer must map to exactly one booking; otherwise leave it for manual reconciliation.
    if (bookings.length > 1) {
      this.logger.warn(
        `Payment sepayId=${event.sepayId} matches multiple bookings [${bookings.map((b) => b.bookingNo).join(', ')}], skipping`,
      );
      return;
    }

    const booking = bookings[0];

    if (!STATUSES_AWAITING_DEPOSIT.includes(booking.status)) {
      this.logger.warn(
        `Booking ${booking.bookingNo} status=${booking.status}, not awaiting deposit, skipping`,
      );
      return;
    }

    const paymentRepo = this.dataSource.getRepository(Payment);
    const providerRef = String(event.sepayId);

    // The bank-side transfer already happened; webhook redelivery must not double-record it.
    if (await paymentRepo.exists({ where: { providerRef } })) {
      this.logger.log(`Payment sepayId=${event.sepayId} already recorded, skipping`);
      return;
    }

    const paidAmount = new Decimal(event.amount);
    const depositRequired = new Decimal(booking.depositTotal);

    // Earlier partial transfers count toward the deposit so a top-up can complete it.
    const priorPaid = new Decimal(
      (await paymentRepo.sum('amount', {
        bookingId: booking.id,
        status: PaymentStatus.SUCCEEDED,
      })) ?? 0,
    );

    const payment = {
      paymentNo: generatePaymentNo(),
      bookingId: booking.id,
      customerId: booking.customerId,
      type: PaymentType.DEPOSIT,
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.SUCCEEDED,
      amount: event.amount,
      providerRef,
      paidAt: new Date(event.transactionDate),
    };

    if (paidAmount.plus(priorPaid).lt(depositRequired)) {
      // The money is still real — keep the receipt; the booking stays pending until covered.
      await paymentRepo.save(payment);
      this.logger.warn(
        `Payment sepayId=${event.sepayId} amount=${event.amount} (received ${paidAmount.plus(priorPaid)}) < deposit ${booking.depositTotal} for booking ${booking.bookingNo} — recorded, awaiting the remainder`,
      );
      return;
    }

    const now = new Date();
    let outcome: 'confirmed' | 'late' | 'status-changed';
    try {
      outcome = await this.dataSource.transaction(async (em) => {
        // Atomic guard — a concurrent webhook delivery may have confirmed already.
        const statusUpdate = await em.update(
          Booking,
          { id: booking.id, status: In(STATUSES_AWAITING_DEPOSIT) },
          { status: BookingStatus.CONFIRMED },
        );
        if (!statusUpdate.affected) return 'status-changed' as const;

        // Mark still-valid holds CONVERTED so the expiry sweep leaves the units held.
        await em.update(
          UnitHold,
          { bookingId: booking.id, status: HoldStatus.ACTIVE, expiresAt: MoreThan(now) },
          { status: HoldStatus.CONVERTED },
        );

        // A leftover ACTIVE hold is expired but not yet swept — the transfer arrived too
        // late. Roll back so the booking can expire and the payment is reconciled manually.
        const leftoverHolds = await em.count(UnitHold, {
          where: { bookingId: booking.id, status: HoldStatus.ACTIVE },
        });
        if (leftoverHolds > 0) throw new LatePaymentError();

        // Receipt for the transfer that covered the deposit.
        await em.save(Payment, payment);
        return 'confirmed' as const;
      });
    } catch (err) {
      if (!(err instanceof LatePaymentError)) throw err;
      outcome = 'late';
    }

    if (outcome === 'confirmed') {
      this.logger.log(
        `Booking ${booking.bookingNo} confirmed via payment sepayId=${event.sepayId} amount=${event.amount}`,
      );
    } else if (outcome === 'late') {
      // The transfer still reached the bank — keep its receipt so reconciliation sees the money
      // even though the rolled-back transaction could not attach it to a confirmed booking.
      await paymentRepo.save(payment);
      this.logger.warn(
        `Payment sepayId=${event.sepayId} for booking ${booking.bookingNo} arrived after holds expired — manual reconciliation needed`,
      );
    } else {
      this.logger.warn(`Booking ${booking.bookingNo} status changed concurrently, skipping`);
    }
  }
}
