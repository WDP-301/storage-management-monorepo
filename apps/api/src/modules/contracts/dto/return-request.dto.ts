import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ReturnRequestInput, UpdateReturnRequestInput } from '@storage/types';
import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { RefundAccountDto } from './refund-account.dto';

// The bounds depend on "now" and the shift templates, so the services check them.
const SCHEDULED_AT_DESCRIPTION =
  'Requested move-out appointment: a future time inside an OFFICE work-shift window (see GET /bookings/receiving-slots), on a Vietnam day from today to 365 days ahead. Staff on shift then are assigned to it';

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
    description: `${SCHEDULED_AT_DESCRIPTION}. Only an appointment: money counts to the day the return is finalized. Re-sending the current appointment is not a move`,
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
  @ApiProperty({
    example: '2027-04-12T12:00:00.000Z',
    description:
      'Day to price the return on; only its Vietnam day (today to 365 days ahead) counts',
  })
  @IsDateString()
  scheduledAt: string;
}
