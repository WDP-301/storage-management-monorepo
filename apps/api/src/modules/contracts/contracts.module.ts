import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { Payment } from '@entities/payment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractCancelService } from './contract-cancel.service';
import { ContractDocumentsService } from './contract-documents.service';
import { ContractQueryService } from './contract-query.service';
import { ContractReturnService } from './contract-return.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { FirstRentService } from './first-rent.service';
import { FirstRentPaymentListener } from './first-rent-payment.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Booking,
      BookingItem,
      Inspection,
      AppUser,
      Invoice,
      InvoiceItem,
      Payment,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ContractsController],
  providers: [
    ContractsService,
    ContractQueryService,
    ContractDocumentsService,
    ContractReturnService,
    ContractCancelService,
    FirstRentService,
    FirstRentPaymentListener,
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
