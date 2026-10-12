import { AccessEvent } from '@entities/access-event.entity';
import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessController } from './access.controller';
import { AccessPassService } from './access-pass.service';
import { CheckInService } from './check-in.service';
import { CheckInHistoryService } from './check-in-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessEvent, Contract, Invoice, UserRoleAssignment]),
    AuthModule,
    SettingsModule,
  ],
  controllers: [AccessController],
  providers: [AccessPassService, CheckInService, CheckInHistoryService],
})
export class AccessModule {}
