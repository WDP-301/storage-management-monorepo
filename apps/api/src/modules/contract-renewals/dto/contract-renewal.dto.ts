import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractRenewalStatus } from '@storage/types';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateContractRenewalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  contractId: string;

  @ApiProperty({ description: 'Months to add, within the booking min/max rental months' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  months: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

export class ApproveContractRenewalDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

export class RejectContractRenewalDto {
  @ApiProperty({ maxLength: 500, description: 'Shown to the customer' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class ListContractRenewalsQueryDto {
  @ApiPropertyOptional({ enum: ContractRenewalStatus })
  @IsIn(Object.values(ContractRenewalStatus))
  @IsOptional()
  status?: ContractRenewalStatus;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
