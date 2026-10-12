import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StorageUnitStatus } from '@storage/types';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IDLE_UNIT_STATUSES } from '../unit-status';
import { MAX_MONTHLY_PRICE, MAX_SIDE_M } from './warehouse.dto';

/** One call may create at most this many shelves, so a typo cannot lock the table with a huge insert. */
export const MAX_BULK_SHELVES = 200;
/** `storage_units.code` is varchar(50); a generated code longer than that cannot be stored. */
export const MAX_UNIT_CODE_LENGTH = 50;

/** What every shelf of a batch shares: its size and rent. */
export class ShelfSpecDto {
  @ApiProperty({ example: 1, description: 'Width in metres' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_SIDE_M)
  widthM: number;

  @ApiProperty({ example: 0.6, description: 'Length (depth) in metres' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_SIDE_M)
  lengthM: number;

  @ApiPropertyOptional({ example: 2, description: 'Clear height in metres' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_SIDE_M)
  @IsOptional()
  heightM?: number;

  @ApiProperty({ example: 300000, description: 'Monthly rent in VND' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONTHLY_PRICE)
  monthlyPrice: number;

  @ApiPropertyOptional({
    example: 1,
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
}

export class CreateShelfDto extends ShelfSpecDto {
  @ApiProperty({
    example: 'KK1-A-03',
    description: 'Unique unit code, normally <warehouse code>-<row>-<slot>',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_UNIT_CODE_LENGTH)
  code: string;

  @ApiPropertyOptional({ description: 'Defaults to "<warehouse name> · Kệ <code>"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Tầng 2, gần cửa sổ' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: IDLE_UNIT_STATUSES, default: StorageUnitStatus.AVAILABLE })
  @IsIn(IDLE_UNIT_STATUSES)
  @IsOptional()
  status?: StorageUnitStatus;
}

export class BulkCreateShelvesDto extends ShelfSpecDto {
  @ApiProperty({
    example: 'A',
    description: 'Row label; codes become <warehouse code>-<prefix>-<number>',
  })
  @Matches(/^[A-Za-z0-9]{1,10}$/, { message: 'prefix must be 1-10 letters or digits' })
  prefix: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  @Max(99_999)
  from: number;

  @ApiProperty({ example: 20, description: `At most ${MAX_BULK_SHELVES} shelves per call` })
  @IsInt()
  @Min(0)
  @Max(99_999)
  to: number;

  @ApiPropertyOptional({ example: 2, default: 2, description: 'Zero-pad width of the number' })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  pad?: number;
}
