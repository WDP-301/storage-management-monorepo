import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftTemplateType } from '@storage/types';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** 24-hour wall-clock time, HH:mm. */
export const HOUR_MINUTE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftTemplateDto {
  @ApiProperty({
    example: 'MORNING',
    description: 'Stable key, unique among shift templates; cannot be changed later',
  })
  @Matches(/^[A-Z0-9_]{2,30}$/, {
    message: 'code must be 2-30 characters of A-Z, 0-9 or _',
  })
  code: string;

  @ApiProperty({ maxLength: 100, example: 'Ca sáng' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: Object.values(ShiftTemplateType),
    example: 'OFFICE',
    description: 'OFFICE = administrative hours, WAREHOUSE = storage duty shift',
  })
  @IsIn(Object.values(ShiftTemplateType))
  type: ShiftTemplateType;

  @ApiProperty({ example: '06:00', description: 'HH:mm, local time' })
  @Matches(HOUR_MINUTE_PATTERN, { message: 'startTime must be HH:mm' })
  startTime: string;

  @ApiProperty({
    example: '12:00',
    description: 'HH:mm, local time; earlier than startTime means the shift ends the next day',
  })
  @Matches(HOUR_MINUTE_PATTERN, { message: 'endTime must be HH:mm' })
  endTime: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
