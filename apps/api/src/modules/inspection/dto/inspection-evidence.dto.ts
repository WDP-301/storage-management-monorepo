import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DamageSeverity } from '@storage/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** A file already uploaded to the private bucket (POST /uploads/presigned-url + PUT). */
export class EvidenceFileDto {
  @ApiProperty({ example: 'uploads/1728300000000-photo.jpg' })
  @IsString()
  @Matches(/^uploads\/[^/]+$/, { message: 'fileKey must be an uploads/ object key' })
  @MaxLength(512)
  fileKey: string;

  @ApiProperty({ example: 'photo.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string;

  @ApiPropertyOptional({ example: 204800 })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}

export class DamageDto {
  @ApiProperty({ maxLength: 1000, example: 'Cửa cuốn bị móp góc trái' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @ApiProperty({ enum: Object.values(DamageSeverity) })
  @IsIn(Object.values(DamageSeverity))
  severity: DamageSeverity;

  @ApiPropertyOptional({ type: [EvidenceFileDto], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EvidenceFileDto)
  evidence?: EvidenceFileDto[];
}
