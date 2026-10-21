import { AppUser } from '@entities/app-user.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Deposit } from '@entities/deposit.entity';
import { Inspection } from '@entities/inspection.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionController } from './inspection.controller';
import { InspectionService } from './inspection.service';
import { InspectionLifecycleService } from './inspection-lifecycle.service';

@Module({
  // Registers every entity the services reach through the EntityManager (autoLoadEntities).
  imports: [
    TypeOrmModule.forFeature([
      Inspection,
      Contract,
      BookingItem,
      StorageUnit,
      AppUser,
      UserRoleAssignment,
      Invoice,
      Deposit,
    ]),
    AuthModule,
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [InspectionController],
  providers: [InspectionService, InspectionLifecycleService],
  exports: [InspectionService],
})
export class InspectionModule {}
