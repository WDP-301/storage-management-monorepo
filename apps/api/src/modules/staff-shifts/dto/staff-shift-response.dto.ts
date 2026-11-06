import { ApiProperty } from '@nestjs/swagger';
import { StaffShiftStatus } from '@storage/types';
import type {
  AutoScheduleResponse,
  PlannedShiftRecord,
  StaffShiftListResponse,
  StaffShiftRecord,
  StaffShiftResponse,
  UnfilledSlotRecord,
} from '../types/staff-shift';

export class StaffShiftRecordDto implements StaffShiftRecord {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  staff_id: string;

  @ApiProperty({ type: String, nullable: true, example: 'Nhân viên kho Demo' })
  staff_name: string | null;

  @ApiProperty({ format: 'uuid' })
  facility_id: string;

  @ApiProperty({ format: 'uuid' })
  shift_template_id: string;

  @ApiProperty({ type: String, nullable: true, example: 'MORNING' })
  shift_template_code: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Ca sáng' })
  shift_template_name: string | null;

  @ApiProperty({ example: '2026-11-10' })
  work_date: string;

  @ApiProperty({ type: String, format: 'date-time' })
  start_at: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
  end_at: string | Date;

  @ApiProperty({ enum: StaffShiftStatus, example: StaffShiftStatus.SCHEDULED })
  status: StaffShiftStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  check_in_at: string | Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  check_out_at: string | Date | null;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  assigned_by: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at: string | Date;
}

export class StaffShiftResponseDto implements StaffShiftResponse {
  @ApiProperty({ type: StaffShiftRecordDto })
  staff_shift: StaffShiftRecordDto;
}

export class StaffShiftListResponseDto implements StaffShiftListResponse {
  @ApiProperty({ type: [StaffShiftRecordDto] })
  staff_shifts: StaffShiftRecordDto[];
}

export class PlannedShiftRecordDto implements PlannedShiftRecord {
  @ApiProperty({ format: 'uuid' })
  staff_id: string;

  @ApiProperty({ example: 'Nhân viên kho Demo' })
  staff_name: string;

  @ApiProperty({ format: 'uuid' })
  shift_template_id: string;

  @ApiProperty({ example: 'MORNING' })
  shift_template_code: string;

  @ApiProperty({ example: 'Ca sáng' })
  shift_template_name: string;

  @ApiProperty({ example: '2026-11-10' })
  work_date: string;

  @ApiProperty({ type: String, format: 'date-time' })
  start_at: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
  end_at: string | Date;
}

export class UnfilledSlotRecordDto implements UnfilledSlotRecord {
  @ApiProperty({ example: '2026-11-10' })
  work_date: string;

  @ApiProperty({ format: 'uuid' })
  shift_template_id: string;

  @ApiProperty({ example: 'EVENING' })
  shift_template_code: string;

  @ApiProperty({ example: 1, description: 'Staff still needed on this shift' })
  missing: number;
}

export class AutoScheduleResponseDto implements AutoScheduleResponse {
  @ApiProperty()
  dry_run: boolean;

  @ApiProperty({ type: [PlannedShiftRecordDto] })
  planned: PlannedShiftRecordDto[];

  @ApiProperty({ type: [UnfilledSlotRecordDto] })
  unfilled: UnfilledSlotRecordDto[];
}
