import { MAX_PROPOSED_FEE } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type SettlementCreditDecision,
  type SettlementDamageDecision,
  type SettlementDecisionsInput,
  SettlementLineType,
  type SettlementWaivedLine,
} from '@storage/types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const WAIVABLE_LINES = [
  SettlementLineType.EARLY_RETURN_SHORT_NOTICE,
  SettlementLineType.OVERSTAY,
] as const;

export const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SettlementDamageDecisionDto implements SettlementDamageDecision {
  @ApiProperty({ minimum: 0, description: 'Position of the damage in the return inspection' })
  @IsInt()
  @Min(0)
  @Max(1000)
  index: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: MAX_PROPOSED_FEE,
    description: 'Fee charged, whole VND; omit when waived',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PROPOSED_FEE)
  amount?: number;

  @ApiPropertyOptional({ description: 'Charge nothing for this damage' })
  @IsOptional()
  @IsBoolean()
  waived?: boolean;
}

export class SettlementCreditDecisionDto implements SettlementCreditDecision {
  @ApiProperty({ format: 'uuid', description: 'Payment of a REVIEW_PAYMENT_CREDIT line' })
  @IsUUID('all')
  paymentId: string;

  @ApiProperty({ description: 'Add the payment back to the refund (true) or leave it out' })
  @IsBoolean()
  include: boolean;
}

export class SettlementWaivedLineDto implements SettlementWaivedLine {
  @ApiProperty({ enum: WAIVABLE_LINES })
  @IsIn(WAIVABLE_LINES)
  type: (typeof WAIVABLE_LINES)[number];

  @ApiProperty({ maxLength: 500, example: 'Khách báo qua hotline từ trước' })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

/** What the reviewer decided; approval needs a decision for every damage and reviewed payment. */
export class SettlementDecisionsDto implements SettlementDecisionsInput {
  @ApiPropertyOptional({ type: [SettlementDamageDecisionDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SettlementDamageDecisionDto)
  damageDecisions?: SettlementDamageDecisionDto[];

  @ApiPropertyOptional({ type: [SettlementCreditDecisionDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SettlementCreditDecisionDto)
  creditDecisions?: SettlementCreditDecisionDto[];

  @ApiPropertyOptional({ type: [SettlementWaivedLineDto], maxItems: 2 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => SettlementWaivedLineDto)
  waivedLines?: SettlementWaivedLineDto[];
}
