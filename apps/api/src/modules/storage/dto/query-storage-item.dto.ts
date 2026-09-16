import { ApiPropertyOptional } from '@nestjs/swagger';
import { StorageItemStatus } from '@storage/types';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryStorageItemDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search keyword across SKU and name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: StorageItemStatus })
  @IsEnum(StorageItemStatus)
  @IsOptional()
  status?: StorageItemStatus;

  @ApiPropertyOptional({ description: 'Filter by Location UUID' })
  @IsString()
  @IsOptional()
  locationId?: string;
}
