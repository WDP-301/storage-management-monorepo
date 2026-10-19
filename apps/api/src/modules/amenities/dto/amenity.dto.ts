import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const AMENITY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

// Trimmed before validation so a whitespace-only name fails `IsNotEmpty` instead of publishing a blank chip.
const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAmenityDto {
  @ApiProperty({
    example: 'AIR_CONDITIONER',
    description: 'Upper snake case; cannot be changed later',
  })
  @IsString()
  @Matches(AMENITY_CODE_PATTERN, {
    message: 'code must be 2-50 chars of A-Z, 0-9 and _, starting with a letter',
  })
  code: string;

  @ApiProperty({ example: 'Điều hòa' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 9999, default: 0 })
  @IsInt()
  @Min(0)
  @Max(9999)
  @IsOptional()
  sortOrder?: number;
}

/** No `code`: it is the stable handle of the amenity, so the global whitelist rejects it with 400. */
export class UpdateAmenityDto {
  @ApiPropertyOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 9999 })
  @IsInt()
  @Min(0)
  @Max(9999)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'false retires the amenity: hidden from pickers and filters',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
