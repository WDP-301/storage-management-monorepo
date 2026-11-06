import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** An inclusive YYYY-MM-DD range of work dates, at most MAX_RANGE_DAYS long. */
export class DateRangeQueryDto {
  @ApiProperty({ example: '2026-11-09', description: 'First work date (YYYY-MM-DD)' })
  @Matches(DATE_PATTERN, { message: 'from must be formatted as YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'from must be a valid calendar date' })
  from: string;

  @ApiProperty({ example: '2026-11-15', description: 'Last work date, included (YYYY-MM-DD)' })
  @Matches(DATE_PATTERN, { message: 'to must be formatted as YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'to must be a valid calendar date' })
  to: string;
}
