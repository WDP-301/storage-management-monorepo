import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@storage/types';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ format: 'uuid', description: 'Facility the ticket is filed against' })
  @IsUUID('all') // 'all' supports UUIDv4 and UUIDv7 (used by DB)
  facilityId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Storage unit within the facility' })
  @IsOptional()
  @IsUUID('all')
  storageUnitId?: string;

  @ApiProperty({ format: 'uuid', description: 'ticket_types.id reference' })
  @IsUUID('all')
  typeId: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.NORMAL })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority = TicketPriority.NORMAL;

  @ApiProperty({ maxLength: 200, example: 'Broken lock' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ maxLength: 5000, example: 'The lock of my storage unit is not working.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ type: [Object], default: [], description: 'Attached file references' })
  @IsOptional()
  @IsArray()
  attachments?: unknown[] = [];
}
