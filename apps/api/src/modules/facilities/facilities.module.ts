import { AuthModule } from '@modules/auth/auth.module';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facility } from './entities/facility.entity';
import { StorageUnit } from './entities/storage-unit.entity';
import { UnitType } from './entities/unit-type.entity';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';
import { StorageUnitsController } from './storage-units.controller';
import { StorageUnitsService } from './storage-units.service';
import { UnitTypesController } from './unit-types.controller';
import { UnitTypesService } from './unit-types.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Facility, UnitType, StorageUnit]),
    forwardRef(() => AuthModule),
  ],
  controllers: [FacilitiesController, UnitTypesController, StorageUnitsController],
  providers: [FacilitiesService, UnitTypesService, StorageUnitsService],
  exports: [FacilitiesService, UnitTypesService, StorageUnitsService],
})
export class FacilitiesModule {}
