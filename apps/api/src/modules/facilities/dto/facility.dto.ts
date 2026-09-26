import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FacilityStatus } from '@storage/types';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFacilityDto {
  @ApiProperty({ example: 'HCM-Q1-01', description: 'Unique facility code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Kho Q1 - Nguyễn Huệ', description: 'Facility display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: '12 Nguyễn Huệ', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine: string;

  @ApiPropertyOptional({ example: '00001', description: 'Ward code (FK → wards.code)' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  wardCode?: string;

  @ApiPropertyOptional({ example: '01', description: 'Province code (FK → provinces.code)' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  provinceCode?: string;

  @ApiProperty({ example: 10.7769, description: 'Latitude (-90 to 90)' })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 106.7009, description: 'Longitude (-180 to 180)' })
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ enum: FacilityStatus, default: FacilityStatus.ACTIVE })
  @IsEnum(FacilityStatus)
  @IsOptional()
  status?: FacilityStatus;
}

export class UpdateFacilityDto extends PartialType(CreateFacilityDto) {}
