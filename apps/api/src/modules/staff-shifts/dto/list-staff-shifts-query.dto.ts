import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class ListStaffShiftsQueryDto extends DateRangeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  facilityId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only this staff member' })
  @IsOptional()
  @IsUUID('all')
  staffId?: string;
}
