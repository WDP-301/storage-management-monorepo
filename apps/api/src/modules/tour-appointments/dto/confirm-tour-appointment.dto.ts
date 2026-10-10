import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ConfirmTourAppointmentDto {
  @ApiPropertyOptional({
    required: false,
    example: '2026-10-16',
    description:
      '(Tùy chọn) Ngày hẹn đã thống nhất lại với khách (nếu có thay đổi so với đăng ký ban đầu, định dạng YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'preferredDate must be formatted as YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'preferredDate must be a valid calendar date' })
  preferredDate?: string;

  @ApiPropertyOptional({
    required: false,
    example: '14:00 - 15:00',
    maxLength: 50,
    description: '(Tùy chọn) Khung giờ đã chốt lại với khách',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredTimeSlot?: string;

  @ApiPropertyOptional({
    required: false,
    example:
      'Đã gọi điện cho anh Khách lúc 09:30, thống nhất lùi sang chiều 14h vì sáng khách bận họp.',
    description: '(Tùy chọn) Ghi chú xác nhận của Quản lý chi nhánh (Facility Manager)',
  })
  @IsOptional()
  @IsString()
  managerNotes?: string;
}
