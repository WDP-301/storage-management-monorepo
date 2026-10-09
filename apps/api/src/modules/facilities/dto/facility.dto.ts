import { ApiPropertyOptional } from '@nestjs/swagger';
import { FacilityStatus } from '@storage/types';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminFacilitiesQueryDto {
  @ApiPropertyOptional({ example: 'Q1', description: 'Code or name contains (case-insensitive)' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ enum: FacilityStatus })
  @IsEnum(FacilityStatus)
  @IsOptional()
  status?: FacilityStatus;

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
}
