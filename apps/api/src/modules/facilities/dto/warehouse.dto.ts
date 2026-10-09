import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StorageUnitStatus } from '@storage/types';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IDLE_UNIT_STATUSES } from '../unit-status';

/** Longest side accepted, in metres — keeps width × length × height inside numeric(14,2). */
const MAX_SIDE_M = 1000;
/** Highest monthly rent accepted, in VND — numeric(14,2) tops out just below 1e12. */
const MAX_MONTHLY_PRICE = 100_000_000_000;

export class CreateWarehouseDto {
  @ApiProperty({ description: 'Owning facility (branch)' })
  @IsUUID()
  facilityId: string;

  @ApiProperty({ example: 'HCM-Q7-01', description: 'Unique warehouse code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Kho Nguyễn Thị Thập 40m²' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: '12 Nguyễn Thị Thập' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine: string;

  @ApiPropertyOptional({
    example: '26734',
    description: 'Ward code; the province is derived from it',
  })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  wardCode?: string;

  @ApiPropertyOptional({ example: '79', description: 'Province code; must match the ward' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  provinceCode?: string;

  @ApiProperty({ example: 10.7377 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 106.7218 })
  @IsLongitude()
  longitude: number;

  @ApiProperty({ example: 5, description: 'Width in metres' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_SIDE_M)
  widthM: number;

  @ApiProperty({ example: 8, description: 'Length in metres' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_SIDE_M)
  lengthM: number;

  @ApiProperty({ example: 3.5, description: 'Clear height in metres' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_SIDE_M)
  heightM: number;

  @ApiProperty({ example: 6500000, description: 'Monthly rent in VND' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONTHLY_PRICE)
  monthlyPrice: number;

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
    maximum: 12,
    nullable: true,
    description: 'Deposit in whole months. Omit or send null to follow deposit.default_months.',
  })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  depositMonths?: number | null;

  @ApiPropertyOptional({ example: 'Có xe nâng, cửa cuốn 3m' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: IDLE_UNIT_STATUSES, default: StorageUnitStatus.AVAILABLE })
  @IsIn(IDLE_UNIT_STATUSES)
  @IsOptional()
  status?: StorageUnitStatus;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}

/** Facility staff may only take a warehouse in or out of service. */
export class UpdateWarehouseStatusDto {
  @ApiProperty({ enum: [StorageUnitStatus.AVAILABLE, StorageUnitStatus.MAINTENANCE] })
  @IsIn([StorageUnitStatus.AVAILABLE, StorageUnitStatus.MAINTENANCE])
  status: StorageUnitStatus;
}

export const WAREHOUSE_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'area_asc',
  'area_desc',
] as const;
export type WarehouseSort = (typeof WAREHOUSE_SORTS)[number];

export class WarehouseListQueryDto {
  @ApiPropertyOptional({ description: 'Only warehouses of this facility' })
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Code, name or address contains (case-insensitive)' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ example: '79' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  provinceCode?: string;

  @ApiPropertyOptional({ example: '26734' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  wardCode?: string;

  @ApiPropertyOptional({ description: 'Minimum floor area (m²)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minArea?: number;

  @ApiPropertyOptional({ description: 'Maximum floor area (m²)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxArea?: number;

  @ApiPropertyOptional({ description: 'Minimum volume (m³)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minVolume?: number;

  @ApiPropertyOptional({ description: 'Maximum volume (m³)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxVolume?: number;

  @ApiPropertyOptional({ description: 'Minimum monthly price (VND)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum monthly price (VND)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ enum: WAREHOUSE_SORTS, default: 'price_asc' })
  @IsIn(WAREHOUSE_SORTS)
  @IsOptional()
  sort?: WarehouseSort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
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

export class AdminWarehouseListQueryDto extends WarehouseListQueryDto {
  @ApiPropertyOptional({ enum: StorageUnitStatus })
  @IsIn(Object.values(StorageUnitStatus))
  @IsOptional()
  status?: StorageUnitStatus;
}
