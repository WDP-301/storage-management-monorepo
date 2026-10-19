import { Amenity } from '@entities/amenity.entity';
import { StorageUnitAmenity } from '@entities/storage-unit-amenity.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Amenity, StorageUnitAmenity]),
    AuthModule, // provides SessionGuard and RolesGuard for the controller
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
