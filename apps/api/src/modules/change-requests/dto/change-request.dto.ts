import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeRequestStatus } from '@storage/types';
import { Type } from 'class-transformer';
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

export class CreateChangeRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Active contract of the caller' })
  @IsUUID('all')
  contractId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Target unit — must be AVAILABLE in the same facility',
  })
  @IsUUID('all')
  newUnitId: string;

  @ApiProperty({ example: 'Cần thêm diện tích chứa hàng' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class DecideChangeRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Note attached to the decision' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}

export class ListChangeRequestsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ChangeRequestStatus })
  @IsOptional()
  status?: ChangeRequestStatus;
}
