import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';

/** Body of a finalize; empty for a handover. */
export class FinalizeInspectionDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2027-04-12',
    description:
      'Return only: Vietnam day the unit was actually handed back, from the day the return was requested to today. Defaults to today.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'returnedOn must be a YYYY-MM-DD day' })
  @IsISO8601({ strict: true }, { message: 'returnedOn must be a real calendar day' })
  returnedOn?: string;
}
