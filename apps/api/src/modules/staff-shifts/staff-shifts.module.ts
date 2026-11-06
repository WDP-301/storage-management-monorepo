import { StaffShift } from '@entities/staff-shift.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { FacilitiesModule } from '@modules/facilities/facilities.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutoScheduleService } from './auto-schedule.service';
import { MyStaffShiftsController } from './my-staff-shifts.controller';
import { MyStaffShiftsService } from './my-staff-shifts.service';
import { StaffShiftAbsenceJob } from './staff-shift-absence.job';
import { StaffShiftsController } from './staff-shifts.controller';
import { StaffShiftsService } from './staff-shifts.service';

/** Managers schedule staff on shift templates; staff read their schedule and check in/out. */
@Module({
  imports: [
    TypeOrmModule.forFeature([StaffShift, UserRoleAssignment]),
    AuthModule,
    FacilitiesModule,
    NotificationsModule,
  ],
  controllers: [StaffShiftsController, MyStaffShiftsController],
  providers: [StaffShiftsService, AutoScheduleService, MyStaffShiftsService, StaffShiftAbsenceJob],
})
export class StaffShiftsModule {}
