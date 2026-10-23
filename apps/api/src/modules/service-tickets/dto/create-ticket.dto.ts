import { EvidenceFileDto } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@storage/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const MAX_TICKET_ATTACHMENTS = 20;

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

  @ApiPropertyOptional({
    type: [EvidenceFileDto],
    default: [],
    maxItems: MAX_TICKET_ATTACHMENTS,
    description: 'Files the customer uploaded themselves (POST /uploads/presigned-url)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TICKET_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => EvidenceFileDto)
  attachments?: EvidenceFileDto[] = [];
}
