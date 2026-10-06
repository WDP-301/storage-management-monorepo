import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { IdempotencyKey } from '@entities/idempotency-key.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      UnitHold,
      IdempotencyKey,
      StorageUnit,
      Payment,
      Invoice,
    ]),
    AuthModule,
    SettingsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
