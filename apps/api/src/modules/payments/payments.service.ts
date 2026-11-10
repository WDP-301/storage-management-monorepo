import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { SepayWebhookDto } from './dto/sepay-webhook.dto';
import { PAYMENT_EVENTS, PaymentReceivedEvent } from './types/payment';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async handleSepayWebhook(dto: SepayWebhookDto): Promise<void> {
    this.logger.log(
      `SePay webhook: id=${dto.id} amount=${dto.transferAmount} type=${dto.transferType}`,
    );

    // Every inbound transfer is persisted before matching so money never dies in a log line:
    // unmatched or failed deliveries stay in the reconciliation queue (outcome RECEIVED) until
    // a listener upgrades them or a person resolves them by hand.
    await this.dataSource.query(
      `INSERT INTO "sepay_transfers"
         ("sepay_id", "amount", "content", "reference_code", "gateway", "transaction_date", "outcome")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("sepay_id") DO NOTHING`,
      [
        String(dto.id),
        dto.transferAmount,
        dto.content ?? null,
        dto.referenceCode ?? null,
        dto.gateway ?? null,
        dto.transactionDate ? new Date(dto.transactionDate) : null,
        dto.transferType === 'in' ? 'RECEIVED' : 'IGNORED',
      ],
    );

    if (dto.transferType !== 'in') return;

    const event = new PaymentReceivedEvent();
    event.sepayId = dto.id;
    event.amount = dto.transferAmount;
    event.content = dto.content;
    event.code = dto.code ?? null;
    event.referenceCode = dto.referenceCode ?? null;
    event.transactionDate = dto.transactionDate;
    event.gateway = dto.gateway;

    await this.eventEmitter.emitAsync(PAYMENT_EVENTS.RECEIVED, event);
  }
}
