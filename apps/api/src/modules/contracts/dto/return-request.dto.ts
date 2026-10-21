import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ReturnRequestInput, UpdateReturnRequestInput } from '@storage/types';
import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { RefundAccountDto } from './refund-account.dto';

// The day bounds (today .. +365 in Vietnam) depend on "now", so the services check them.
const SCHEDULED_AT_DESCRIPTION =
  'Requested move-out date; its Vietnam calendar day must be from today to 365 days ahead';

export class ReturnRequestDto implements ReturnRequestInput {
  @ApiProperty({ example: '2027-04-12T12:00:00.000Z', description: SCHEDULED_AT_DESCRIPTION })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    type: RefundAccountDto,
    description: 'Where to refund the deposit; frozen on the request once it is finalized',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RefundAccountDto)
  refundAccount?: RefundAccountDto;
}

/** Omitted fields stay as they are. */
export class UpdateReturnRequestDto implements UpdateReturnRequestInput {
  @ApiPropertyOptional({
    example: '2027-04-12T12:00:00.000Z',
    description: `${SCHEDULED_AT_DESCRIPTION}. Moving it earlier restarts the notice from now`,
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ maxLength: 1000, description: 'An empty note clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ type: RefundAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RefundAccountDto)
  refundAccount?: RefundAccountDto;
}

export class ReturnPreviewQueryDto {
  @ApiProperty({ example: '2027-04-12T12:00:00.000Z', description: SCHEDULED_AT_DESCRIPTION })
  @IsDateString()
  scheduledAt: string;
}
