import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractStatus, SettlementStatus } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** `settlementStatus` filter values and the settlement status each stands for. */
export const SETTLEMENT_STATUS_FILTER = {
  pending: 'PENDING',
  awaiting_refund: SettlementStatus.AWAITING_REFUND,
  completed: SettlementStatus.COMPLETED,
} as const;
export type SettlementStatusFilter = keyof typeof SETTLEMENT_STATUS_FILTER;

export class ListContractsQueryDto {
  @ApiPropertyOptional({ enum: ContractStatus })
  @IsIn(Object.values(ContractStatus))
  @IsOptional()
  status?: ContractStatus;

  @ApiPropertyOptional({
    enum: Object.keys(SETTLEMENT_STATUS_FILTER),
    description: 'Deposit settlement: pending = ENDED and not approved yet',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(Object.keys(SETTLEMENT_STATUS_FILTER))
  @IsOptional()
  settlementStatus?: SettlementStatusFilter;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only contracts of this facility' })
  @IsUUID('all')
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({
    description: 'Contract number, warehouse code, customer name, phone or email contains',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
