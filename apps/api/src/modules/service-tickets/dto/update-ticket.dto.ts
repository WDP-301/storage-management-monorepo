import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '@storage/types';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Fields an assigned FACILITY_STAFF member may update while processing a ticket.
 * Ownership fields (customer_id, facility_id, assigned_to, ticket_no, …) are not
 * accepted here; the update target and the acting user are resolved server-side.
 */
export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Resolution notes; null clears the current resolution',
  })
  @IsOptional()
  @IsString()
  resolution?: string | null;

  @ApiPropertyOptional({ type: [Object], description: 'Replaces the attachment list' })
  @IsOptional()
  @IsArray()
  attachments?: unknown[];
}
