import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TIMESTAMP_WITH_OFFSET,
  TIMESTAMP_WITH_OFFSET_MESSAGE,
} from '@shared/utils/timestamp-offset.util';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PickupRequestLineDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Item on the shelf (from the contract storage view)',
  })
  @IsUUID('all')
  itemId: string;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity: number;
}

export class CreatePickupRequestDto {
  @ApiProperty({ type: [PickupRequestLineDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PickupRequestLineDto)
  lines: PickupRequestLineDto[];

  @ApiProperty({
    description: 'When the customer plans to come, within the next 30 days',
    example: '2026-11-10T09:00:00+07:00',
  })
  @IsISO8601({ strict: true })
  @Matches(TIMESTAMP_WITH_OFFSET, { message: TIMESTAMP_WITH_OFFSET_MESSAGE })
  requestedFor: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class WarehousePickupQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'ALL'], default: 'OPEN' })
  @IsOptional()
  @IsIn(['OPEN', 'ALL'])
  status?: 'OPEN' | 'ALL';
}
