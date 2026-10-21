import { Contract } from '@entities/contract.entity';
import { ContractSettlement } from '@entities/contract-settlement.entity';
import { CustomerProfile } from '@entities/customer-profile.entity';
import { Deposit } from '@entities/deposit.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { InvoiceItem } from '@entities/invoice-item.entity';
import { Payment } from '@entities/payment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementApproveService } from './settlement-approve.service';
import { SettlementQueryService } from './settlement-query.service';
import { SettlementRefundService } from './settlement-refund.service';
import { SettlementsController } from './settlements.controller';

/** Deposit settlement of ended contracts (operations and admins). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractSettlement,
      Deposit,
      Contract,
      Invoice,
      InvoiceItem,
      Payment,
      Inspection,
      CustomerProfile,
    ]),
    AuthModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [SettlementsController],
  providers: [SettlementQueryService, SettlementApproveService, SettlementRefundService],
})
export class SettlementsModule {}
