import { MAX_UNIT_AMENITIES } from '@modules/amenities/unit-amenities';
import { EvidenceFileDto } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IDLE_UNIT_STATUSES } from '../unit-status';
import { MAX_AMENITY_FILTER, toIdList, WarehouseAmenityDto } from './warehouse-amenity.dto';

/** Longest side accepted, in metres — keeps width × length × height inside numeric(14,2). */
export const MAX_SIDE_M = 1000;
/** Highest monthly rent accepted, in VND — numeric(14,2) tops out just below 1e12. */
export const MAX_MONTHLY_PRICE = 100_000_000_000;

export const MAX_WAREHOUSE_IMAGES = 10;

export const WAREHOUSE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/**
 * An uploaded file restricted to photos. The rule is attached to the inherited property:
 * redeclaring the field would reset it under `useDefineForClassFields`.
 */
export class WarehouseImageDto extends EvidenceFileDto {}
IsIn(WAREHOUSE_IMAGE_MIME_TYPES)(WarehouseImageDto.prototype, 'mimeType');
ApiProperty({ enum: WAREHOUSE_IMAGE_MIME_TYPES })(WarehouseImageDto.prototype, 'mimeType');

/** Kinds an admin can create directly; shelves are created through their shelf warehouse. */
export const CREATABLE_WAREHOUSE_KINDS = [
  StorageUnitKind.SELF_STORAGE,
  StorageUnitKind.SHELF_WAREHOUSE,
] as const;

export class CreateWarehouseDto {
  @ApiPropertyOptional({
    enum: CREATABLE_WAREHOUSE_KINDS,
    default: StorageUnitKind.SELF_STORAGE,
    description: 'SHELF_WAREHOUSE is rented per shelf: it has no price or deposit of its own',
  })
  @IsIn(CREATABLE_WAREHOUSE_KINDS)
  @IsOptional()
  kind?: StorageUnitKind;

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

  @ApiPropertyOptional({
    example: 6500000,
    description:
      'Monthly rent in VND; required, except it must be omitted for a shelf warehouse (priced per shelf)',
  })
  @ValidateIf((dto: CreateWarehouseDto) => dto.kind !== StorageUnitKind.SHELF_WAREHOUSE)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONTHLY_PRICE)
  monthlyPrice?: number;

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

  @ApiPropertyOptional({
    type: [WarehouseImageDto],
    maxItems: MAX_WAREHOUSE_IMAGES,
    description: 'The full photo list in display order (first is the cover); replaces the old one',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WAREHOUSE_IMAGES)
  @ArrayUnique((image: WarehouseImageDto) => image.fileKey)
  @ValidateNested({ each: true })
  @Type(() => WarehouseImageDto)
  images?: WarehouseImageDto[];

  @ApiPropertyOptional({
    type: [WarehouseAmenityDto],
    maxItems: MAX_UNIT_AMENITIES,
    description:
      'The full amenity list; replaces the old one, [] removes all, omitted leaves it as is. ' +
      'Not accepted on a shelf: shelves carry none, read the shelf warehouse’s list instead.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_UNIT_AMENITIES)
  @ArrayUnique((amenity: WarehouseAmenityDto) => amenity.amenityId)
  @ValidateNested({ each: true })
  @Type(() => WarehouseAmenityDto)
  amenities?: WarehouseAmenityDto[];
}

/** The kind is fixed at creation: shelves and contracts depend on it. */
export class UpdateWarehouseDto extends PartialType(
  OmitType(CreateWarehouseDto, ['kind'] as const),
) {}

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

  @ApiPropertyOptional({
    default: false,
    description:
      'Catalogue only: also list shelf warehouses. Clients that do not understand per-shelf ' +
      'rental leave it off and never see a shelf warehouse.',
  })
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  @IsBoolean()
  @IsOptional()
  includeShelfWarehouses?: boolean;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_AMENITY_FILTER,
    description: 'Comma-separated or repeated amenity ids; a warehouse must have all of them',
  })
  @Transform(toIdList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_AMENITY_FILTER)
  @IsUUID(undefined, { each: true })
  amenityIds?: string[];

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
