import { Module } from '@nestjs/common';
import { SepayHmacGuard } from './guards/sepay-hmac.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, SepayHmacGuard],
})
export class PaymentsModule {}
