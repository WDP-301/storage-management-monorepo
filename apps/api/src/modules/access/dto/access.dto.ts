import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePassDto {
  @ApiProperty({ format: 'uuid', description: 'ACTIVE shelf contract of the caller' })
  @IsUUID('all')
  contractId: string;
}

export class CheckInDto {
  @ApiProperty({ description: 'Text decoded from the customer QR code', example: 'SMCI1:…' })
  @IsString()
  @MaxLength(100)
  qrPayload: string;
}

export class ListCheckInsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only check-ins at this facility' })
  @IsUUID('all')
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Entered at or after (ISO 8601)' })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Entered at or before (ISO 8601)' })
  @IsISO8601()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Contract number, shelf code, customer name or phone contains',
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
