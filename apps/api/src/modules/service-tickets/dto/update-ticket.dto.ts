import { EvidenceFileDto } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketStatus } from '@storage/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_TICKET_ATTACHMENTS } from './create-ticket.dto';

/**
 * Fields an assigned FACILITY_STAFF member may update while processing a ticket;
 * `priority` is accepted only from a manager of the ticket's facility or an admin.
 * Ownership fields (customer_id, facility_id, assigned_to, ticket_no, …) are not
 * accepted here; the update target and the acting user are resolved server-side.
 * CANCELLED is rejected here — it belongs to the cancel endpoint, which carries
 * the owner/manager authorization. Status only moves forward
 * (OPEN → ASSIGNED → IN_PROGRESS → RESOLVED); CLOSED stays settable as its own
 * end state (dropped or resolved informally); RESOLVED already ends the ticket.
 */
export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 5000,
    description: 'Resolution notes; null clears the current resolution',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resolution?: string | null;

  @ApiPropertyOptional({
    type: [EvidenceFileDto],
    maxItems: MAX_TICKET_ATTACHMENTS,
    description: 'Replaces the attachment list',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TICKET_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => EvidenceFileDto)
  attachments?: EvidenceFileDto[];
}
