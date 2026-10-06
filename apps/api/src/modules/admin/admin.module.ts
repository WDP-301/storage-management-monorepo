import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { Session } from '@entities/session.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
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
