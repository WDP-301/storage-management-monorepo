import { FacilitiesModule } from '@modules/facilities/facilities.module';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { Session } from '@modules/users/entities/session.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './auth.cookie';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser, Session, UserRoleAssignment]), FacilitiesModule],
  controllers: [AuthController],
  providers: [AuthService, AuthCookieService, SessionGuard],
})
export class AuthModule {}
