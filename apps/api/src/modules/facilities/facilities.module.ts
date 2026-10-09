import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';
import { FacilityCommandService } from './facility-command.service';
import { WarehouseCommandService } from './warehouse-command.service';
import { WarehouseQueryService } from './warehouse-query.service';
import { WarehousesController } from './warehouses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Facility, StorageUnit, UserRoleAssignment]),
    AuthModule, // provides SessionGuard and RolesGuard for controllers
    SettingsModule,
  ],
  controllers: [FacilitiesController, WarehousesController],
  providers: [
    FacilitiesService,
    FacilityCommandService,
    WarehouseQueryService,
    WarehouseCommandService,
  ],
  exports: [FacilitiesService, WarehouseQueryService],
})
export class FacilitiesModule {}
