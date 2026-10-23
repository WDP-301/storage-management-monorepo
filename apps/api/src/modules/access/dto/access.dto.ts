import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// A date alone would be read as UTC midnight and cut off the rest of that day, so the time and
// offset must be explicit.
const TIMESTAMP_WITH_OFFSET = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const TIMESTAMP_MESSAGE =
  '$property must be a full timestamp with offset, e.g. 2026-10-12T23:59:59+07:00';

export class CheckInDto {
  @ApiProperty({ description: 'Text decoded from the customer QR code', example: 'SMCI1:…' })
  @IsString()
  @MaxLength(100)
  qrPayload: string;

  @ApiProperty({ format: 'uuid', description: 'Shelf warehouse the customer is entering' })
  @IsUUID('all')
  warehouseId: string;
}

export class InsideQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Shelf warehouse to list the visitors of' })
  @IsUUID('all')
  warehouseId: string;
}

export class ManualCheckOutDto {
  @ApiProperty({ description: 'Why the exit was not scanned', example: 'Khách hết pin điện thoại' })
  @IsString()
  @Matches(/\S/, { message: 'note must not be blank' })
  @MaxLength(255)
  note: string;
}

export class ListCheckInsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only check-ins at this facility' })
  @IsUUID('all')
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Entered at or after (ISO 8601 timestamp with offset)' })
  @IsISO8601({ strict: true })
  @Matches(TIMESTAMP_WITH_OFFSET, { message: TIMESTAMP_MESSAGE })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Entered at or before (ISO 8601 timestamp with offset)' })
  @IsISO8601({ strict: true })
  @Matches(TIMESTAMP_WITH_OFFSET, { message: TIMESTAMP_MESSAGE })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Customer name or phone, or warehouse code or name contains',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
