import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeRequestStatus } from '@storage/types';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateChangeRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Active contract of the caller' })
  @IsUUID('all')
  contractId: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Target unit — must be AVAILABLE, of the same kind as the current unit, in an active facility (may be a different facility)',
  })
  @IsUUID('all')
  newUnitId: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'Day and time the customer wants to move — a Vietnam day between contract.unit_change_min_lead_days and contract.unit_change_max_days_ahead days from today, at a future time inside an OFFICE work-shift window (see GET /bookings/receiving-slots)',
  })
  @IsDateString()
  scheduledMoveAt: string;

  @ApiProperty({ example: 'Cần thêm diện tích chứa hàng' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class DecideChangeRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      "Confirmed move day and time — defaults to the customer's pick. Must be in the future, inside an OFFICE work-shift window and within contract.unit_change_max_days_ahead days. Required when the request carries none (legacy rows).",
  })
  @IsOptional()
  @IsDateString()
  moveAt?: string;

  @ApiPropertyOptional({ description: 'Note attached to the decision' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}

export class ListChangeRequestsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ChangeRequestStatus })
  @IsEnum(ChangeRequestStatus)
  @IsOptional()
  status?: ChangeRequestStatus;
}

export class ChangeRequestOptionsQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Active contract of the caller' })
  @IsUUID('all')
  contractId: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
