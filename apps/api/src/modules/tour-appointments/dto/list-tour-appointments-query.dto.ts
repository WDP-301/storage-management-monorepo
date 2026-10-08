import { ApiPropertyOptional } from '@nestjs/swagger';
import { TourAppointmentStatus } from '@storage/types';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export class ListTourAppointmentsQueryDto {
  @ApiPropertyOptional({
    required: false,
    default: 1,
    minimum: 1,
    example: 1,
    description: '(Tùy chọn) Trang cần xem (bắt đầu từ 1, mặc định: 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    required: false,
    default: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    example: 20,
    description: '(Tùy chọn) Số lượng kết quả trên một trang (mặc định: 20, tối đa: 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    required: false,
    enum: TourAppointmentStatus,
    example: TourAppointmentStatus.PENDING,
    description:
      '(Tùy chọn) Lọc theo trạng thái cuộc hẹn (PENDING, CONFIRMED, ASSIGNED, COMPLETED, CANCELLED)',
  })
  @IsOptional()
  @IsEnum(TourAppointmentStatus)
  status?: TourAppointmentStatus;

  @ApiPropertyOptional({
    required: false,
    format: 'uuid',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: '(Tùy chọn) Lọc theo cơ sở kho (Facility ID)',
  })
  @IsOptional()
  @IsUUID('all')
  facilityId?: string;

  @ApiPropertyOptional({
    required: false,
    format: 'uuid',
    example: 'c1b48b61-d703-4f93-8ef4-9e3f225d3fa2',
    description: '(Tùy chọn) Lọc theo nhân viên cơ sở được phân công (Assigned To Staff ID)',
  })
  @IsOptional()
  @IsUUID('all')
  assignedTo?: string;

  @ApiPropertyOptional({
    required: false,
    example: '2026-10-01',
    description: '(Tùy chọn) Lọc các cuộc hẹn từ ngày (định dạng YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must be formatted as YYYY-MM-DD' })
  fromDate?: string;

  @ApiPropertyOptional({
    required: false,
    example: '2026-10-31',
    description: '(Tùy chọn) Lọc các cuộc hẹn đến ngày (định dạng YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must be formatted as YYYY-MM-DD' })
  toDate?: string;
}
