import { Facility } from '@entities/facility.entity';
import { ShelfLayout } from '@entities/shelf-layout.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { UploadModule } from '@modules/upload/upload.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';
import { FacilityCommandService } from './facility-command.service';
import { LayoutController } from './layout/layout.controller';
import { LayoutService } from './layout/layout.service';
import { ShelfCommandService } from './shelf-command.service';
import { ShelvesController } from './shelves.controller';
import { WarehouseCommandService } from './warehouse-command.service';
import { WarehouseQueryService } from './warehouse-query.service';
import { WarehousesController } from './warehouses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Facility, ShelfLayout, StorageUnit, UserRoleAssignment]),
    AuthModule, // provides SessionGuard and RolesGuard for controllers
    SettingsModule,
    UploadModule, // presigns warehouse photo links
  ],
  controllers: [FacilitiesController, WarehousesController, ShelvesController, LayoutController],
  providers: [
    FacilitiesService,
    FacilityCommandService,
    WarehouseQueryService,
    WarehouseCommandService,
    ShelfCommandService,
    LayoutService,
  ],
  exports: [FacilitiesService, WarehouseQueryService],
})
export class FacilitiesModule {}
