import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateInspectionDto {
  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  conditionNotes?: string | null;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  evidence?: unknown[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  damages?: unknown[];

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  finalizedAt?: string | null;
}
