import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketStatus } from '@storage/types';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Fields an assigned FACILITY_STAFF member may update while processing a ticket.
 * Ownership fields (customer_id, facility_id, assigned_to, ticket_no, …) are not
 * accepted here; the update target and the acting user are resolved server-side.
 * CANCELLED is rejected here — it belongs to the cancel endpoint, which carries
 * the owner/manager authorization. CLOSED stays settable: customers confirm the
 * fix in person and the assigned staff member records it.
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

  @ApiPropertyOptional({ type: [Object], description: 'Replaces the attachment list' })
  @IsOptional()
  @IsArray()
  attachments?: unknown[];
}
