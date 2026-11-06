import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShelfReceiptStatus, ShelfReceiptType } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ShelfPageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}

export class ShelfReceiptSearchQueryDto extends ShelfPageQueryDto {
  @ApiPropertyOptional({
    description: 'Receipt code, customer name, phone or contract number contains',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ShelfReceiptType })
  @IsEnum(ShelfReceiptType)
  @IsOptional()
  type?: ShelfReceiptType;

  @ApiPropertyOptional({ enum: ShelfReceiptStatus })
  @IsEnum(ShelfReceiptStatus)
  @IsOptional()
  status?: ShelfReceiptStatus;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Vietnam day, inclusive' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-07', description: 'Vietnam day, inclusive' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: 'true = only receipts with an open dispute ticket' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  disputed?: boolean;
}
