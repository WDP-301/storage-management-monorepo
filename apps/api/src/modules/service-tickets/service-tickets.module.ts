import { AuthModule } from '@modules/auth/auth.module';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { UserRoleAssignment } from '@modules/customer/entities/user-role-assignment.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceTicket } from './entities/service-ticket.entity';
import { TicketType } from './entities/ticket-type.entity';
import { ServiceTicketsController } from './service-tickets.controller';
import { ServiceTicketsService } from './service-tickets.service';

/**
 * Service ticket handling with role + resource-scope authorization:
 * CUSTOMER owns tickets, FACILITY_MANAGER covers their facilities and assigns staff,
 * FACILITY_STAFF only sees/updates tickets assigned to them.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceTicket,
      TicketType,
      UserRoleAssignment,
      AppUser,
      Facility,
      StorageUnit,
    ]),
    AuthModule,
  ],
  controllers: [ServiceTicketsController],
  providers: [ServiceTicketsService],
})
export class ServiceTicketsModule {}
