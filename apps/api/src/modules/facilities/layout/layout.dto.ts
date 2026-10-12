import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LayoutElementType } from '@storage/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_GRID_SIDE,
  MAX_LAYOUT_ELEMENTS,
  MAX_LAYOUT_PLACEMENTS,
  MAX_LAYOUT_TEXT,
} from './layout-rules';

/** Postgres `integer` ceiling; a larger version could never match a stored one. */
const MAX_VERSION = 2_147_483_647;

/**
 * Cell rectangle, 0-based from the top-left. Only the shape is checked here; whether it fits the
 * grid and clashes with other items depends on the whole document and is judged by `validateLayout`.
 */
export class LayoutRectDto {
  @ApiProperty({ minimum: 0, example: 0 })
  @IsInt()
  @Min(0)
  row: number;

  @ApiProperty({ minimum: 0, example: 1 })
  @IsInt()
  @Min(0)
  col: number;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  rowSpan: number;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  colSpan: number;
}

export class LayoutElementDto extends LayoutRectDto {
  @ApiProperty({ enum: LayoutElementType })
  @IsEnum(LayoutElementType)
  type: LayoutElementType;

  @ApiPropertyOptional({ maxLength: MAX_LAYOUT_TEXT, description: 'Required for a LABEL' })
  @IsString()
  @MaxLength(MAX_LAYOUT_TEXT * 2) // trimmed length is checked against the real limit later
  @IsOptional()
  text?: string;
}

export class ShelfPlacementDto extends LayoutRectDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  shelfId: string;
}

export class SaveLayoutDto {
  @ApiProperty({ minimum: 1, maximum: MAX_GRID_SIDE, example: 12 })
  @IsInt()
  @Min(1)
  @Max(MAX_GRID_SIDE)
  rows: number;

  @ApiProperty({ minimum: 1, maximum: MAX_GRID_SIDE, example: 20 })
  @IsInt()
  @Min(1)
  @Max(MAX_GRID_SIDE)
  cols: number;

  @ApiProperty({ type: [LayoutElementDto], maxItems: MAX_LAYOUT_ELEMENTS })
  @ArrayMaxSize(MAX_LAYOUT_ELEMENTS)
  @ValidateNested({ each: true })
  @Type(() => LayoutElementDto)
  elements: LayoutElementDto[];

  @ApiProperty({ type: [ShelfPlacementDto], maxItems: MAX_LAYOUT_PLACEMENTS })
  @ArrayMaxSize(MAX_LAYOUT_PLACEMENTS)
  @ValidateNested({ each: true })
  @Type(() => ShelfPlacementDto)
  placements: ShelfPlacementDto[];

  @ApiProperty({
    minimum: 0,
    description: 'Version the editor loaded; 0 when the warehouse had no layout yet',
  })
  @IsInt()
  @Min(0)
  @Max(MAX_VERSION)
  version: number;
}

export class DeleteLayoutQueryDto {
  @ApiProperty({ minimum: 0, description: 'Version the editor loaded' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_VERSION)
  version: number;
}
