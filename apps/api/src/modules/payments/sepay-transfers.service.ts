import { Booking } from '@entities/booking.entity';
import { SepayTransfer } from '@entities/sepay-transfer.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { BookingsService } from '@modules/bookings/bookings.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { BookingStatus, SEPAY_ATTENTION_OUTCOMES, SepayTransferOutcome } from '@storage/types';
import { DataSource, In } from 'typeorm';
import type { AssignSepayTransferDto, ListSepayTransfersQueryDto } from './dto/sepay-transfer.dto';
import { PaymentReceivedEvent } from './types/payment';

const AWAITING_DEPOSIT: BookingStatus[] = [BookingStatus.HOLDING, BookingStatus.PENDING_DEPOSIT];

/**
 * The reconciliation queue: bank transfers the matcher could not place. Nothing here is guessed
 * — a transfer is either assigned to a booking (replaying the deposit-confirmation path) or a
 * person writes down how it was handled outside the system.
 */
@Injectable()
export class SepayTransfersService {
  private readonly logger = new Logger(SepayTransfersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly bookings: BookingsService,
  ) {}

  async list(query: ListSepayTransfersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const attention = query.attention !== 'false';
    const [rows, total] = await this.dataSource.getRepository(SepayTransfer).findAndCount({
      where: attention ? { outcome: In(SEPAY_ATTENTION_OUTCOMES) } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { transfers: rows.map(toRecord), meta: buildPaginationMeta(page, limit, total) };
  }

  /** Attach a queued transfer to a booking, replaying the deposit-confirmation path. */
  async assign(
    id: string,
    dto: AssignSepayTransferDto,
    actor: AuthUser,
  ): Promise<{ outcome: string; message: string }> {
    const transfer = await this.dataSource.getRepository(SepayTransfer).findOne({ where: { id } });
    if (!transfer) notFound('SepayTransfer', id);
    if (!SEPAY_ATTENTION_OUTCOMES.includes(transfer.outcome)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Transfer is already ${transfer.outcome}`,
        HttpStatus.CONFLICT,
        { outcome: transfer.outcome },
      );
    }

    const where = dto.bookingId
      ? { id: dto.bookingId }
      : dto.bookingNo
        ? { bookingNo: dto.bookingNo.trim() }
        : null;
    if (!where) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'bookingId or bookingNo is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const booking = await this.dataSource.getRepository(Booking).findOne({ where });
    if (!booking) notFound('Booking', dto.bookingId ?? dto.bookingNo ?? '');
    if (!AWAITING_DEPOSIT.includes(booking.status)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Booking ${booking.bookingNo} is ${booking.status}, not awaiting a deposit`,
        HttpStatus.CONFLICT,
        { bookingId: booking.id, status: booking.status },
      );
    }

    const event = new PaymentReceivedEvent();
    event.sepayId = Number(transfer.sepayId);
    event.amount = Number(transfer.amount);
    event.content = transfer.content ?? '';
    event.code = null;
    event.referenceCode = transfer.referenceCode;
    event.transactionDate = transfer.transactionDate?.toISOString() ?? '';
    event.gateway = transfer.gateway ?? '';

    const { outcome, reviewReason } = await this.bookings.applyDepositTransfer(booking, event);

    // The transfer is settled only when the deposit path accepted it — confirmed means the
    // booking went CONFIRMED, partial/recorded means the money reached the deposit ledger.
    const settled =
      outcome === 'confirmed' || outcome === 'partial' || outcome === 'already-recorded';
    await this.dataSource.query(
      `UPDATE "sepay_transfers"
          SET "outcome" = $2, "booking_id" = $3, "resolved_by" = $4, "resolved_at" = now(),
              "resolution_note" = $5
        WHERE "id" = $1 AND "outcome" <> 'RESOLVED'`,
      [
        id,
        settled ? SepayTransferOutcome.RESOLVED : SepayTransferOutcome.NEEDS_REVIEW,
        booking.id,
        actor.id,
        dto.note?.trim() || (settled ? `assigned by ${actor.id}` : `assign attempted: ${outcome}`),
      ],
    );

    const message =
      outcome === 'confirmed'
        ? `Booking ${booking.bookingNo} confirmed — deposit covered, contracts created`
        : outcome === 'partial'
          ? `Recorded toward the deposit of ${booking.bookingNo}; still awaiting the remainder`
          : outcome === 'already-recorded'
            ? 'This transfer was already recorded on that booking'
            : outcome === 'late'
              ? `Booking ${booking.bookingNo} holds expired — the transfer stays queued`
              : `Could not apply: ${reviewReason || outcome}`;
    this.logger.log(
      `Sepay transfer ${transfer.sepayId} assigned to ${booking.bookingNo} by ${actor.id}: ${outcome}`,
    );
    return { outcome, message };
  }

  /** Close a queued transfer the matcher can never place, with a written explanation. */
  async resolve(id: string, note: string, actor: AuthUser): Promise<{ outcome: string }> {
    const updated = await this.dataSource.query(
      `UPDATE "sepay_transfers"
          SET "outcome" = 'RESOLVED', "resolved_by" = $2, "resolved_at" = now(), "resolution_note" = $3
        WHERE "id" = $1 AND "outcome" <> 'RESOLVED'
        RETURNING "id"`,
      [id, actor.id, note.trim()],
    );
    if (!updated?.length) {
      const exists = await this.dataSource.getRepository(SepayTransfer).exists({ where: { id } });
      if (!exists) notFound('SepayTransfer', id);
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Transfer is already resolved',
        HttpStatus.CONFLICT,
      );
    }
    this.logger.log(`Sepay transfer ${id} resolved by ${actor.id}: ${note}`);
    return { outcome: 'RESOLVED' };
  }
}

function toRecord(t: SepayTransfer) {
  return {
    id: t.id,
    sepay_id: t.sepayId,
    amount: Number(t.amount),
    content: t.content,
    reference_code: t.referenceCode,
    gateway: t.gateway,
    transaction_date: t.transactionDate,
    outcome: t.outcome,
    booking_id: t.bookingId,
    invoice_id: t.invoiceId,
    resolved_by: t.resolvedBy,
    resolved_at: t.resolvedAt,
    resolution_note: t.resolutionNote,
    created_at: t.createdAt,
  };
}
