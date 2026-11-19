import { Contract } from '@entities/contract.entity';
import { ContractRenewal } from '@entities/contract-renewal.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractRenewalQueryService } from './contract-renewal-query.service';
import { ContractRenewalsController } from './contract-renewals.controller';
import { ContractRenewalsService } from './contract-renewals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractRenewal, Contract]),
    AuthModule,
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [ContractRenewalsController],
  providers: [ContractRenewalsService, ContractRenewalQueryService],
})
export class ContractRenewalsModule {}
