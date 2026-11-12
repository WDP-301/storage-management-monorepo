import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { IdempotencyKey } from '@entities/idempotency-key.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import { ShiftTemplate } from '@entities/shift-template.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitHold } from '@entities/unit-hold.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { InspectionModule } from '@modules/inspection/inspection.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
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
      // Deposit confirmation creates contracts and handover inspections (persistContract); the
      // deposit ledger row it also records is written with plain SQL and needs no repository.
      Contract,
      Inspection,
      ShiftTemplate,
      AppUser,
    ]),
    AuthModule,
    InspectionModule,
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
