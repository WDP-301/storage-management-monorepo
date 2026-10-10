import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractStatus } from '@storage/types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListContractsQueryDto {
  @ApiPropertyOptional({ enum: ContractStatus })
  @IsIn(Object.values(ContractStatus))
  @IsOptional()
  status?: ContractStatus;

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
