import { AuthModule } from '@modules/auth/auth.module';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { UnitHold } from './entities/unit-hold.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingItem, UnitHold, IdempotencyKey, StorageUnit]),
    AuthModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
