import { AuthModule } from '@modules/auth/auth.module';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { Session } from '@modules/customer/entities/session.entity';
import { UserRoleAssignment } from '@modules/customer/entities/user-role-assignment.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * Admin-only user administration. Reuses `SessionGuard` + `RolesGuard` exported by `AuthModule`,
 * so every route here requires an authenticated session holding the ADMIN role.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AppUser, UserRoleAssignment, Facility, Session]), AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}
