import { AuthModule } from '@modules/auth/auth.module';
import { Booking } from '@modules/bookings/entities/booking.entity';
import { BookingItem } from '@modules/bookings/entities/booking-item.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Booking, BookingItem]), AuthModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
