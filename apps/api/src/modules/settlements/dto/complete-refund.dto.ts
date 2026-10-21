import { EvidenceFileDto } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { CompleteRefundInput } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { trimText } from './settlement-decisions.dto';

/** Proof of the manual refund transfer: evidence files, a transfer reference, or both. */
export class CompleteRefundDto implements CompleteRefundInput {
  @ApiPropertyOptional({ type: [EvidenceFileDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EvidenceFileDto)
  evidence?: EvidenceFileDto[];

  @ApiPropertyOptional({ maxLength: 100, description: 'Bank reference of the transfer; unique' })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  transferRef?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
