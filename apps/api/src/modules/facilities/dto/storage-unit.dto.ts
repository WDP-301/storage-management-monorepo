import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StorageUnitStatus } from '@storage/types';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateStorageUnitDto {
  @ApiProperty({ example: 'uuid-of-facility' })
  @IsUUID('all')
  facilityId: string;

  @ApiProperty({ example: 'uuid-of-unit-type' })
  @IsUUID('all')
  unitTypeId: string;

  @ApiProperty({ example: 'A-01', description: 'Unit code unique within facility' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 'A', description: 'Zone/section within facility' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  zone?: string;

  /**
   * posX and posY must both be provided or both be omitted.
   * DB constraint: ("pos_x" IS NULL) = ("pos_y" IS NULL)
   */
  @ApiPropertyOptional({
    example: 1.5,
    description: 'X position on floor map. Must be set together with posY.',
  })
  @ValidateIf((o: CreateStorageUnitDto) => o.posX !== undefined || o.posY !== undefined)
  @IsNumber()
  posX?: number;

  @ApiPropertyOptional({
    example: 3.0,
    description: 'Y position on floor map. Must be set together with posX.',
  })
  @ValidateIf((o: CreateStorageUnitDto) => o.posX !== undefined || o.posY !== undefined)
  @IsNumber()
  posY?: number;

  @ApiProperty({ example: 2.25, description: 'Area in m²' })
  @IsNumber()
  @IsPositive()
  @Min(0.1)
  areaM2: number;

  @ApiPropertyOptional({ example: 'Góc thoáng, gần lối thoát hiểm' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateStorageUnitDto extends PartialType(CreateStorageUnitDto) {
  @ApiPropertyOptional({ enum: StorageUnitStatus })
  @IsEnum(StorageUnitStatus)
  @IsOptional()
  status?: StorageUnitStatus;
}

export class QueryStorageUnitsDto {
  @ApiPropertyOptional({ description: 'Filter by facility ID' })
  @IsUUID('all')
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Filter by unit type ID' })
  @IsUUID('all')
  @IsOptional()
  unitTypeId?: string;

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
  @Max(100) // #4: prevent DoS via huge limit
  limit?: number = 20;
}
