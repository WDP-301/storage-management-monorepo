import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({ format: 'uuid', description: 'FACILITY_STAFF user id to assign the ticket to' })
  @IsUUID('all')
  assignedTo: string;
}
