import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTourAppointmentDto {
  @ApiProperty({
    format: 'uuid',
    example: 'c1b48b61-d703-4f93-8ef4-9e3f225d3fa2',
    description:
      '(Bắt buộc) Mã định danh (User ID) của nhân viên chi nhánh (FACILITY_STAFF) thuộc chi nhánh này để gán tiếp đón khách',
  })
  @IsUUID('all')
  assignedTo: string;
}
