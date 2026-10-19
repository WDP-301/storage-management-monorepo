import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Most amenities a listing filter may require at once. */
export const MAX_AMENITY_FILTER = 10;

// `IsUUID` accepts either case but ids are compared as plain strings (de-duplication, catalog
// lookup, the "has all" count), so normalise to the lowercase form Postgres returns.
function lowerCaseId({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

/** One amenity installed in a warehouse, as sent when creating or updating it. */
export class WarehouseAmenityDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(lowerCaseId)
  @IsUUID()
  amenityId: string;

  @ApiProperty({ minimum: 1, maximum: 99, example: 2 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  @IsOptional()
  note?: string | null;
}

/**
 * Query-string id list: `?amenityIds=a,b` and `?amenityIds=a&amenityIds=b` both work. Values are
 * trimmed, lowercased, blanks dropped and repeats removed, so the "has all" count matches distinct ids.
 */
export function toIdList({ obj, key }: TransformFnParams): unknown {
  const raw: unknown = obj[key];
  if (raw === undefined || raw === null) return undefined;
  const parts = Array.isArray(raw) ? raw : [raw];
  if (!parts.every((part) => typeof part === 'string')) return parts;
  const ids = parts
    .flatMap((part: string) => part.split(','))
    .map((part) => part.trim().toLowerCase());
  return [...new Set(ids.filter((id) => id.length > 0))];
}
