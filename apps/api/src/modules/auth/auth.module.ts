import { FacilitiesModule } from '@modules/facilities/facilities.module';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { Session } from '@modules/users/entities/session.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './auth.cookie';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppUser, Session, UserRoleAssignment]),
    forwardRef(() => FacilitiesModule),
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
