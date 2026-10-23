import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Deposit } from '@entities/deposit.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { Payment } from '@entities/payment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { BanksModule } from '@modules/banks/banks.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractCancelService } from './contract-cancel.service';
import { ContractDocumentsService } from './contract-documents.service';
import { ContractInvoicesController } from './contract-invoices.controller';
import { ContractInvoicesService } from './contract-invoices.service';
import { ContractQueryService } from './contract-query.service';
import { ContractReturnController } from './contract-return.controller';
import { ContractReturnService } from './contract-return.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { FirstRentService } from './first-rent.service';
import { FirstRentPaymentListener } from './first-rent-payment.listener';
import { ManagedReturnService } from './managed-return.service';
import { ReturnPreviewService } from './return-preview.service';
import { TermEndReminderService } from './term-end-reminder.service';

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
      Deposit,
    ]),
    AuthModule,
    BanksModule,
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [ContractsController, ContractReturnController, ContractInvoicesController],
  providers: [
    ContractsService,
    ContractQueryService,
    ContractDocumentsService,
    ContractReturnService,
    ManagedReturnService,
    ReturnPreviewService,
    ContractCancelService,
    ContractInvoicesService,
    FirstRentService,
    FirstRentPaymentListener,
    TermEndReminderService,
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
