import { EvidenceFileDto } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManualPaymentMethod, type RecordInvoicePaymentInput } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimText } from '../../settlements/dto/settlement-decisions.dto';

export const MAX_PAYMENT_EVIDENCE = 5;

/** A payment taken outside SePay matching (cash, or a transfer with the wrong content). */
export class RecordInvoicePaymentDto implements RecordInvoicePaymentInput {
  @ApiProperty({ enum: ManualPaymentMethod })
  @IsEnum(ManualPaymentMethod)
  method: ManualPaymentMethod;

  @ApiProperty({ example: 1500000, description: 'VND; at most the amount still due' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: '2026-10-20T09:30:00.000Z', description: 'Defaults to now' })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'Bank reference of the transfer; unique' })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  transferRef?: string;

  @ApiPropertyOptional({ type: [EvidenceFileDto], maxItems: MAX_PAYMENT_EVIDENCE })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PAYMENT_EVIDENCE)
  @ValidateNested({ each: true })
  @Type(() => EvidenceFileDto)
  evidence?: EvidenceFileDto[];

  @ApiProperty({ maxLength: 1000, example: 'Khách chuyển khoản ghi sai nội dung' })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string;
}
