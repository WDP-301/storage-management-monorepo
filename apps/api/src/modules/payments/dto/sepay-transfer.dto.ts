import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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

export class ListSepayTransfersQueryDto {
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

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    default: 'true',
    description: "'true' (default) lists only the reconciliation queue; 'false' lists everything",
  })
  @IsIn(['true', 'false'])
  @IsOptional()
  attention?: 'true' | 'false' = 'true';
}

export class AssignSepayTransferDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Booking the transfer is deposit for — id or bookingNo, one required',
  })
  @IsOptional()
  @IsUUID('all')
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Booking number, e.g. BK-20261110-1234' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  bookingNo?: string;

  @ApiPropertyOptional({ description: 'Why this assignment is correct' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}

export class ResolveSepayTransferDto {
  @ApiProperty({
    description: 'How the transfer was handled outside the system (required for audit)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;
}
