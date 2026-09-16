import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateStorageLocationDto {
  @ApiProperty({ example: 'WH-A1', description: 'Unique location or warehouse code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Main Central Warehouse - Rack A1', description: 'Location name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Ground floor zone A' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '123 Logistics Way, District 7' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Maximum capacity units' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  capacity?: number;
}
