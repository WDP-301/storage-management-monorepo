import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { CustomerProfile } from '@entities/customer-profile.entity';
import { Document } from '@entities/document.entity';
import { Session } from '@entities/session.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './auth.cookie';
import { AuthService } from './auth.service';
import { OptionalSessionGuard } from './guards/optional-session.guard';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppUser,
      Session,
      UserRoleAssignment,
      CustomerProfile,
      Document,
      Contract,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCookieService, SessionGuard, OptionalSessionGuard, RolesGuard],
  /**
   * `SessionGuard` is applied as an enhancer in other modules (e.g. `AdminModule`), and Nest
   * resolves an enhancer's constructor arguments inside the module that *uses* it. So the
   * exported guards' dependencies must be exported too, otherwise Nest reports the guard's
   * own dependencies as unresolvable.
   */
  exports: [AuthService, AuthCookieService, SessionGuard, OptionalSessionGuard, RolesGuard],
})
export class AuthModule {}
