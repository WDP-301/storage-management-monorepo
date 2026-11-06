import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { MAX_NOTE_LENGTH } from './create-staff-shifts.dto';
import { DATE_PATTERN } from './date-range-query.dto';

/** Moves a shift that has not started to another shift or day, or edits its note. */
export class UpdateStaffShiftDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'An active shift template' })
  @IsOptional()
  @IsUUID('all')
  shiftTemplateId?: string;

  @ApiPropertyOptional({ example: '2026-11-12' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'workDate must be formatted as YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'workDate must be a valid calendar date' })
  workDate?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAX_NOTE_LENGTH,
    description: 'null clears the note',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string | null;
}
