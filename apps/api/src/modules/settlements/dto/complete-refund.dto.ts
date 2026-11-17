import { RefundAccountDto } from '@modules/contracts/dto/refund-account.dto';
import { EvidenceFileDto } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CompleteRefundInput } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { trimText } from './settlement-decisions.dto';

/** Proof of the manual refund transfer: at least one evidence file, and the bank reference if known. */
export class CompleteRefundDto implements CompleteRefundInput {
  @ApiProperty({ type: [EvidenceFileDto], minItems: 1, maxItems: 5 })
  @IsArray()
  @ArrayMinSize(1, { message: 'Đính kèm ít nhất 1 ảnh chứng từ chuyển khoản' })
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EvidenceFileDto)
  evidence: EvidenceFileDto[];

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

  @ApiPropertyOptional({
    type: RefundAccountDto,
    description:
      'Refund recipient account; required when none was recorded yet (e.g. DRAFT cancel)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RefundAccountDto)
  bankAccount?: RefundAccountDto;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(500)
  bankOverrideReason?: string;
}
