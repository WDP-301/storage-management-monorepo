import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    type: [String],
    example: ['uuid-unit-101', 'uuid-unit-102'],
    description: 'List of storage unit IDs to book',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true }) // 'all' supports UUIDv4 and UUIDv7 (used by DB)
  storageUnitIds: string[];

  @ApiProperty({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Requested rental start date',
  })
  @IsDateString()
  requestedStartAt: string;

  @ApiProperty({ example: 3, description: 'Number of months to rent', minimum: 1, maximum: 60 })
  @IsInt()
  @Min(1)
  @Max(60)
  rentalMonths: number;

  @ApiPropertyOptional({ example: 'uuid-facility', description: 'Preferred facility ID' })
  @IsUUID('all') // 'all' supports UUIDv4 and UUIDv7
  @IsOptional()
  preferredFacilityId?: string;
}
