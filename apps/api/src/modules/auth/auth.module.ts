import { Facility } from '@modules/facilities/entities/facility.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { Session } from '@modules/users/entities/session.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './auth.cookie';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser, Session, UserRoleAssignment, Facility])],
  controllers: [AuthController],
  providers: [AuthService, AuthCookieService, SessionGuard, RolesGuard],
  exports: [AuthService, AuthCookieService, SessionGuard, RolesGuard],
})
export class AuthModule {}
