import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UploadModule } from '@modules/upload/upload.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfWorker } from './invoice-pdf.worker';
import { InvoiceScheduleService } from './invoice-schedule.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Contract]),
    AuthModule,
    NotificationsModule,
    UploadModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, InvoicePdfWorker, InvoiceScheduleService],
  exports: [InvoicesService, InvoicePdfService],
})
export class InvoicesModule {}
