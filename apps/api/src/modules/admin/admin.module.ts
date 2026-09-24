import { AuthModule } from '@modules/auth/auth.module';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * Admin-only user administration. Reuses `SessionGuard` + `RolesGuard` exported by `AuthModule`,
 * so every route here requires an authenticated session holding the ADMIN role.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AppUser, UserRoleAssignment, Facility]), AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}
