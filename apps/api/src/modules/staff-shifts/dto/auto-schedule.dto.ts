import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_STAFF_PER_REQUEST } from './create-staff-shifts.dto';
import { DateRangeQueryDto } from './date-range-query.dto';

export class ShiftRequirementDto {
  @ApiProperty({ format: 'uuid', description: 'An active shift template' })
  @IsUUID('all')
  shiftTemplateId: string;

  @ApiProperty({ example: 2, description: 'How many staff each of these shifts needs' })
  @IsInt()
  @Min(1)
  @Max(MAX_STAFF_PER_REQUEST)
  staffPerShift: number;
}

/** Fills each shift of each day in the range up to its required headcount. */
export class AutoScheduleDto extends DateRangeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  facilityId: string;

  @ApiProperty({ type: [ShiftRequirementDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((requirement: ShiftRequirementDto) => requirement.shiftTemplateId)
  @ValidateNested({ each: true })
  @Type(() => ShiftRequirementDto)
  requirements: ShiftRequirementDto[];

  @ApiProperty({ description: 'true only previews the plan; false saves it and notifies staff' })
  @IsBoolean()
  dryRun: boolean;
}
