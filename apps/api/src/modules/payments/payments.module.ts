import { SepayTransfer } from '@entities/sepay-transfer.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { BookingsModule } from '@modules/bookings/bookings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SepayHmacGuard } from './guards/sepay-hmac.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SepayTransfersController } from './sepay-transfers.controller';
import { SepayTransfersService } from './sepay-transfers.service';

@Module({
  imports: [TypeOrmModule.forFeature([SepayTransfer]), AuthModule, BookingsModule],
  controllers: [PaymentsController, SepayTransfersController],
  providers: [PaymentsService, SepayTransfersService, SepayHmacGuard],
})
export class PaymentsModule {}
