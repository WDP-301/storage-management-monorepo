import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  TIMESTAMP_WITH_OFFSET,
  TIMESTAMP_WITH_OFFSET_MESSAGE,
} from '@shared/utils/timestamp-offset.util';
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

export class ListCheckInsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only check-ins at this facility' })
  @IsUUID('all')
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Entered at or after (ISO 8601 timestamp with offset)' })
  @IsISO8601({ strict: true })
  @Matches(TIMESTAMP_WITH_OFFSET, { message: TIMESTAMP_WITH_OFFSET_MESSAGE })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Entered at or before (ISO 8601 timestamp with offset)' })
  @IsISO8601({ strict: true })
  @Matches(TIMESTAMP_WITH_OFFSET, { message: TIMESTAMP_WITH_OFFSET_MESSAGE })
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
