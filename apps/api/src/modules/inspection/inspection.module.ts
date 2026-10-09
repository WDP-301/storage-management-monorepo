import { AppUser } from '@entities/app-user.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
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
    ]),
    AuthModule,
  ],
  controllers: [InspectionController],
  providers: [InspectionService, InspectionLifecycleService],
  exports: [InspectionService],
})
export class InspectionModule {}
