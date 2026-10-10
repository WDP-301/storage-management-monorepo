import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FacilityStatus } from '@storage/types';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

export class CreateFacilityDto {
  @ApiProperty({ example: 'CN-HCM', description: 'Unique facility code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Chi nhánh Hồ Chí Minh' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: '79', description: 'Optional region (province code)' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  provinceCode?: string;
}

export class UpdateFacilityDto extends PartialType(CreateFacilityDto) {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Send null to clear the region',
  })
  declare provinceCode?: string | null;

  @ApiPropertyOptional({ enum: FacilityStatus })
  @IsEnum(FacilityStatus)
  @IsOptional()
  status?: FacilityStatus;
}
