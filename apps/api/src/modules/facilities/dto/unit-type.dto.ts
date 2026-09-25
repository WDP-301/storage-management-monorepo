import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateUnitTypeDto {
  @ApiProperty({ example: 'S-2M2', description: 'Unique unit type code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Small (2m²)', description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 1.5, description: 'Width in metres' })
  @IsNumber()
  @IsPositive()
  widthM: number;

  @ApiProperty({ example: 1.5, description: 'Length in metres' })
  @IsNumber()
  @IsPositive()
  lengthM: number;

  @ApiPropertyOptional({ example: 2.4, description: 'Height in metres (optional)' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  heightM?: number;

  @ApiProperty({ example: 500000, description: 'Monthly price in VND' })
  @IsNumber()
  @Min(0)
  monthlyPrice: number;

  @ApiPropertyOptional({ example: 1, description: 'Default deposit months multiplier' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  defaultDepositMonths?: number;
}

export class UpdateUnitTypeDto extends PartialType(CreateUnitTypeDto) {}
