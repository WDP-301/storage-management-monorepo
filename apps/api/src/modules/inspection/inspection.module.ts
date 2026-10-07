import { AppUser } from '@entities/app-user.entity';
import { Inspection } from '@entities/inspection.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionController } from './inspection.controller';
import { InspectionService } from './inspection.service';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, AppUser, UserRoleAssignment]), AuthModule],
  controllers: [InspectionController],
  providers: [InspectionService],
  exports: [InspectionService],
})
export class InspectionModule {}
