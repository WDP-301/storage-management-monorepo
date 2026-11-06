import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { MAX_RANGE_DAYS } from '../shift-calendar';
import { DATE_PATTERN } from './date-range-query.dto';

export const MAX_STAFF_PER_REQUEST = 50;
export const MAX_NOTE_LENGTH = 500;

/** Schedules every listed staff member on the shift for every listed date, all or nothing. */
export class CreateStaffShiftsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  facilityId: string;

  @ApiProperty({ format: 'uuid', description: 'An active shift template' })
  @IsUUID('all')
  shiftTemplateId: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: `Staff of the facility, 1-${MAX_STAFF_PER_REQUEST}`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STAFF_PER_REQUEST)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  staffIds: string[];

  @ApiProperty({
    type: [String],
    example: ['2026-11-10', '2026-11-11'],
    description: `Work dates (YYYY-MM-DD), 1-${MAX_RANGE_DAYS}`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_RANGE_DAYS)
  @ArrayUnique()
  @Matches(DATE_PATTERN, { each: true, message: 'workDates must be formatted as YYYY-MM-DD' })
  @IsDateString({ strict: true }, { each: true, message: 'workDates must be valid calendar dates' })
  workDates: string[];

  @ApiPropertyOptional({ maxLength: MAX_NOTE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
