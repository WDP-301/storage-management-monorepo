import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DamageDto, EvidenceFileDto } from './inspection-evidence.dto';

export class UpdateInspectionDto {
  @ApiPropertyOptional({
    example: '2027-04-12T12:00:00.000Z',
    description:
      'Return inspections only: new appointment, its Vietnam day from today to 365 days ahead. Moving it earlier restarts the customer notice from now.',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

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
