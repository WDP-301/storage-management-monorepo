import { Contract } from '@entities/contract.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UnitChangeRequest } from '@entities/unit-change-request.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UnitChangeRequest, Contract, StorageUnit, UserRoleAssignment]),
    AuthModule,
  ],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService],
})
export class ChangeRequestsModule {}
