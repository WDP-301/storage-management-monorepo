import { Contract } from '@entities/contract.entity';
import { ShiftTemplate } from '@entities/shift-template.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { InspectionModule } from '@modules/inspection/inspection.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';
import { MoveDaySweepService } from './move-day-sweep.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UnitChangeRequest,
      Contract,
      StorageUnit,
      UserRoleAssignment,
      ShiftTemplate,
    ]),
    AuthModule,
    InspectionModule,
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService, MoveDaySweepService],
})
export class ChangeRequestsModule {}
