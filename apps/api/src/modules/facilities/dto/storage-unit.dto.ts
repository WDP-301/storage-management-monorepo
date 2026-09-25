import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StorageUnitStatus } from '@storage/types';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStorageUnitDto {
  @ApiProperty({ example: 'uuid-of-facility' })
  @IsUUID()
  facilityId: string;

  @ApiProperty({ example: 'uuid-of-unit-type' })
  @IsUUID()
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

  @ApiPropertyOptional({ example: 1.5, description: 'X position on floor map' })
  @IsNumber()
  @IsOptional()
  posX?: number;

  @ApiPropertyOptional({ example: 3.0, description: 'Y position on floor map' })
  @IsNumber()
  @IsOptional()
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
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Filter by unit type ID' })
  @IsUUID()
  @IsOptional()
  unitTypeId?: string;

  @ApiPropertyOptional({ enum: StorageUnitStatus, default: StorageUnitStatus.AVAILABLE })
  @IsEnum(StorageUnitStatus)
  @IsOptional()
  status?: StorageUnitStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number = 20;
}
