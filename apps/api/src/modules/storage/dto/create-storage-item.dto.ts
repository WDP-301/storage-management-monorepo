import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StorageItemStatus } from '@storage/types';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStorageItemDto {
  @ApiProperty({ example: 'SKU-LOG-001', description: 'Stock Keeping Unit code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku: string;

  @ApiProperty({ example: 'Industrial Steel Pallet', description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Heavy duty 1200x800mm pallet' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 120, description: 'Current available quantity' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ example: 15, default: 5, description: 'Threshold for low stock alert' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  minQuantity?: number;

  @ApiPropertyOptional({ example: 'pcs', default: 'pcs' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ example: 45.5, default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ enum: StorageItemStatus, default: StorageItemStatus.IN_STOCK })
  @IsEnum(StorageItemStatus)
  @IsOptional()
  status?: StorageItemStatus;

  @ApiPropertyOptional({ example: 'b6f654b0-37cb-4ca4-9271-bf17fbda21b4' })
  @IsUUID()
  @IsOptional()
  locationId?: string;
}

export class UpdateStorageItemDto {
  @ApiPropertyOptional({ example: 'Updated Item Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 85 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  minQuantity?: number;

  @ApiPropertyOptional({ example: 'box' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ example: 52.0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ enum: StorageItemStatus })
  @IsEnum(StorageItemStatus)
  @IsOptional()
  status?: StorageItemStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  locationId?: string;
}
