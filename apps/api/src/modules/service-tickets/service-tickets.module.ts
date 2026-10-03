import { AppUser } from '@entities/app-user.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { ServiceTicket } from '@entities/service-ticket.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TicketType } from '@entities/ticket-type.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
      Contract,
      BookingItem,
    ]),
    AuthModule,
  ],
  controllers: [ServiceTicketsController],
  providers: [ServiceTicketsService],
})
export class ServiceTicketsModule {}
