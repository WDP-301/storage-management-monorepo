import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facility } from './entities/facility.entity';

/**
 * Owns the `facilities` domain entity. No repository is injected here yet, but `Facility`
 * must be part of the connection so relations pointing at it (e.g. `UserRoleAssignment.facility`)
 * can resolve their metadata.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Facility])],
})
export class FacilitiesModule {}
