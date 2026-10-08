import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TourAppointmentsController } from './tour-appointments.controller';
import { TourAppointmentsService } from './tour-appointments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TourAppointment, Facility, StorageUnit, AppUser, UserRoleAssignment]),
    AuthModule,
  ],
  controllers: [TourAppointmentsController],
  providers: [TourAppointmentsService],
  exports: [TourAppointmentsService],
})
export class TourAppointmentsModule {}
