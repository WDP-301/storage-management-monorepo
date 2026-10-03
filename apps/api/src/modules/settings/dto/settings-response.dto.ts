import { ApiProperty } from '@nestjs/swagger';
import type { SettingValueType } from '../settings.registry';
import type { SystemSettingRecord, SystemSettingsResponse } from '../types/settings';

const VALUE_TYPES: SettingValueType[] = [
  'int',
  'float',
  'string',
  'boolean',
  'duration_minutes',
  'int_list',
];

export class SystemSettingRecordDto implements SystemSettingRecord {
  @ApiProperty({ example: 'booking.hold_minutes' })
  key: string;

  @ApiProperty({ description: 'Current value — shape depends on value_type', example: 15 })
  value: unknown;

  @ApiProperty({ enum: VALUE_TYPES, example: 'int' })
  value_type: SettingValueType;

  @ApiProperty({ example: 'booking' })
  group: string;

  @ApiProperty({ example: 'Thời gian giữ kho (phút)' })
  label: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true, example: 15 })
  default: unknown;

  @ApiProperty({ nullable: true, example: 5 })
  min: number | null;

  @ApiProperty({ nullable: true, example: 60 })
  max: number | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  updated_by: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at: string | Date;
}

export class SystemSettingsResponseDto implements SystemSettingsResponse {
  @ApiProperty({ type: [SystemSettingRecordDto] })
  settings: SystemSettingRecordDto[];
}
