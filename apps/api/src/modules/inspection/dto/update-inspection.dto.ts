import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DamageDto, EvidenceFileDto } from './inspection-evidence.dto';

export class UpdateInspectionDto {
  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @ValidateIf((_object, value) => value != null)
  @IsString()
  @MaxLength(5000)
  conditionNotes?: string | null;

  @ApiPropertyOptional({ type: [EvidenceFileDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EvidenceFileDto)
  evidence?: EvidenceFileDto[];

  @ApiPropertyOptional({ type: [DamageDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DamageDto)
  damages?: DamageDto[];
}
