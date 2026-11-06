import { ApiProperty } from '@nestjs/swagger';
import type {
  ShiftTemplateListResponse,
  ShiftTemplateRecord,
  ShiftTemplateResponse,
} from '../types/shift-template';

export class ShiftTemplateRecordDto implements ShiftTemplateRecord {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'MORNING' })
  code: string;

  @ApiProperty({ example: 'Ca sáng' })
  name: string;

  @ApiProperty({ example: '06:00' })
  start_time: string;

  @ApiProperty({ example: '12:00' })
  end_time: string;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at: string | Date;
}

export class ShiftTemplateResponseDto implements ShiftTemplateResponse {
  @ApiProperty({ type: ShiftTemplateRecordDto })
  shift_template: ShiftTemplateRecordDto;
}

export class ShiftTemplateListResponseDto implements ShiftTemplateListResponse {
  @ApiProperty({ type: [ShiftTemplateRecordDto] })
  shift_templates: ShiftTemplateRecordDto[];
}
