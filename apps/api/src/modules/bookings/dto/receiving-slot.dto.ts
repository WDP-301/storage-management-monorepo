import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** An inclusive YYYY-MM-DD range of Vietnam calendar days to list receiving windows for. */
export class ReceivingSlotQueryDto {
  @ApiProperty({ example: '2026-11-09', description: 'First day (YYYY-MM-DD)' })
  @Matches(DATE_PATTERN, { message: 'from must be formatted as YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'from must be a valid calendar date' })
  from: string;

  @ApiProperty({ example: '2026-11-15', description: 'Last day, included (YYYY-MM-DD)' })
  @Matches(DATE_PATTERN, { message: 'to must be formatted as YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'to must be a valid calendar date' })
  to: string;
}

export class ReceivingWindowDto {
  @ApiProperty({ format: 'date-time', description: 'Window opens (inclusive)' })
  startAt: string;

  @ApiProperty({ format: 'date-time', description: 'Window closes (exclusive)' })
  endAt: string;
}

export class ReceivingDayDto {
  @ApiProperty({ example: '2026-11-09' })
  date: string;

  @ApiProperty({ type: [ReceivingWindowDto] })
  windows: ReceivingWindowDto[];
}

export class ReceivingSlotsResponseDto {
  @ApiProperty({ type: [ReceivingDayDto] })
  days: ReceivingDayDto[];
}

/** Plain shape returned by `BookingsService.listReceivingSlots`. */
export interface ReceivingSlotsResponse {
  days: { date: string; windows: { startAt: string; endAt: string }[] }[];
}
