import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AutocompleteQueryDto {
  @ApiProperty({ example: 'Vinhome Grand Park', description: 'Search input' })
  @IsString()
  @IsNotEmpty()
  input: string;
}

export class PlaceDetailQueryDto {
  @ApiProperty({ example: 'some-goong-place-id', description: 'Goong place_id from autocomplete' })
  @IsString()
  @IsNotEmpty()
  place_id: string;
}

export class NearbyQueryDto {
  @ApiPropertyOptional({
    example: 'some-goong-place-id',
    description: 'Goong place_id from autocomplete. Omit when lat/lng are provided.',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  place_id?: string;

  @ApiPropertyOptional({
    example: 10.7769,
    description: 'Latitude of search center (e.g. user GPS). Must be sent together with lng.',
  })
  @IsLatitude()
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({
    example: 106.7009,
    description: 'Longitude of search center (e.g. user GPS). Must be sent together with lat.',
  })
  @IsLongitude()
  @IsOptional()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Search radius in km (default 5, max 50)',
    default: 5,
  })
  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(50)
  @Type(() => Number)
  radius?: number = 5;
}
