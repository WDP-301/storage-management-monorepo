import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractReturnService } from './contract-return.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Booking, BookingItem, Inspection, AppUser]),
    AuthModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService, ContractReturnService],
  exports: [ContractsService],
})
export class ContractsModule {}
