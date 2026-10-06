import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SepayWebhookDto } from './dto/sepay-webhook.dto';
import { PAYMENT_EVENTS, PaymentReceivedEvent } from './types/payment';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async handleSepayWebhook(dto: SepayWebhookDto): Promise<void> {
    this.logger.log(
      `SePay webhook: id=${dto.id} amount=${dto.transferAmount} type=${dto.transferType}`,
    );

    if (dto.transferType !== 'in') return;

    const event = new PaymentReceivedEvent();
    event.sepayId = dto.id;
    event.amount = dto.transferAmount;
    event.content = dto.content;
    event.code = dto.code ?? null;
    event.transactionDate = dto.transactionDate;
    event.gateway = dto.gateway;

    await this.eventEmitter.emitAsync(PAYMENT_EVENTS.RECEIVED, event);
  }
}
