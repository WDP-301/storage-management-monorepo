import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class AutocompleteQueryDto {
  @ApiProperty({ example: 'Vinhome Grand Park', description: 'Search input' })
  @IsString()
  @IsNotEmpty()
  input: string;
}

export class NearbyQueryDto {
  @ApiProperty({ example: 'some-goong-place-id', description: 'Goong place_id from autocomplete' })
  @IsString()
  @IsNotEmpty()
  place_id: string;

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
