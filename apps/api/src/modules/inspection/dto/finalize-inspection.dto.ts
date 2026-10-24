import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';

/** Body of a finalize; empty for a handover. */
export class FinalizeInspectionDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2027-04-12',
    deprecated: true,
    description:
      'Ignored: a return is always recorded on the Vietnam day it is finalized. Still accepted so older staff apps that send the day they picked keep working.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'returnedOn must be a YYYY-MM-DD day' })
  @IsISO8601({ strict: true }, { message: 'returnedOn must be a real calendar day' })
  returnedOn?: string;
}
