import { RefundAccountDto } from '@modules/contracts/dto/refund-account.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApproveSettlementInput } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { SettlementDecisionsDto, trimText } from './settlement-decisions.dto';

export class ApproveSettlementDto extends SettlementDecisionsDto implements ApproveSettlementInput {
  @ApiProperty({ description: '`version` of the preview the reviewer approved' })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/, { message: 'expectedVersion must be a preview version' })
  expectedVersion: string;

  @ApiPropertyOptional({
    type: RefundAccountDto,
    description: 'Where the refund goes; required when there is money to refund',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RefundAccountDto)
  bankAccount?: RefundAccountDto;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Khách cung cấp qua kênh khác',
    description: 'Required when the account is not the one the customer gave (or they gave none)',
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(500)
  bankOverrideReason?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
