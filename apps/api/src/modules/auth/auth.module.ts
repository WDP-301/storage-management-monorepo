import { Contract } from '@modules/contracts/entities/contract.entity';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { CustomerProfile } from '@modules/customer/entities/customer-profile.entity';
import { Session } from '@modules/customer/entities/session.entity';
import { UserRoleAssignment } from '@modules/customer/entities/user-role-assignment.entity';
import { Document } from '@modules/misc/entities/document.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './auth.cookie';
import { AuthService } from './auth.service';
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
  providers: [AuthService, AuthCookieService, SessionGuard, RolesGuard],
  /**
   * `SessionGuard` is applied as an enhancer in other modules (e.g. `AdminModule`), and Nest
   * resolves an enhancer's constructor arguments inside the module that *uses* it. So the
   * exported guards' dependencies must be exported too, otherwise Nest reports the guard's
   * own dependencies as unresolvable.
   */
  exports: [AuthService, AuthCookieService, SessionGuard, RolesGuard],
})
export class AuthModule {}
