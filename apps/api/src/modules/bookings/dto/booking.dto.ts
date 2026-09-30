import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateBookingItemDto {
  @ApiProperty({
    example: '018f673a-4001-7000-8000-000000000001',
    description: 'Storage unit ID (UUIDv4/v7)',
  })
  @IsUUID('all')
  storageUnitId: string;

  @ApiProperty({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Requested rental start date for this unit',
  })
  @IsDateString()
  requestedStartAt: string;

  @ApiProperty({
    example: 3,
    description: 'Number of months to rent for this unit',
    minimum: 1,
    maximum: 60,
  })
  @IsInt()
  @Min(1)
  @Max(60)
  rentalMonths: number;
}

export class CreateBookingDto {
  @ApiProperty({
    type: [CreateBookingItemDto],
    description: 'List of storage units to book with individual schedules',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingItemDto)
  items: CreateBookingItemDto[];
}
