import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateContactTourDto {
  @ApiProperty({
    format: 'uuid',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: '(Bắt buộc) Mã cơ sở kho khách hàng muốn đến tham quan, xem phòng',
  })
  @IsUUID('all')
  facilityId: string;

  @ApiProperty({
    example: 'Nguyễn Văn Khách',
    maxLength: 150,
    description: '(Bắt buộc) Họ và tên của người liên hệ',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({
    example: '0987654321',
    maxLength: 30,
    description: '(Bắt buộc) Số điện thoại liên hệ (di động/Zalo)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @ApiProperty({
    example: 'khachhang@example.com',
    maxLength: 255,
    description: '(Bắt buộc) Địa chỉ email để nhận thông tin xác nhận lịch hẹn',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: '2026-10-15',
    description: '(Bắt buộc) Ngày hẹn đến xem kho mong muốn (định dạng YYYY-MM-DD)',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'preferredDate must be formatted as YYYY-MM-DD',
  })
  preferredDate: string;

  @ApiPropertyOptional({
    required: false,
    example: '09:00 - 11:00',
    maxLength: 50,
    description: '(Tùy chọn) Khung giờ mong muốn đến xem (ví dụ: Sáng 9h-11h, Chiều 14h-16h)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredTimeSlot?: string;

  @ApiPropertyOptional({
    required: false,
    example: 'Tôi muốn tìm kho 12m2 có điều hòa để lưu trữ tài liệu kế toán doanh nghiệp',
    description: '(Tùy chọn) Nội dung chi tiết nhu cầu hoặc lời nhắn thêm của khách',
  })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiPropertyOptional({
    required: false,
    format: 'uuid',
    example: 'f3b89098-971c-4b53-9097-f50f4a86989f',
    description:
      '(Tùy chọn) Mã phòng kho cụ thể nếu khách xem trên danh sách kho và bấm Đăng ký xem phòng này',
  })
  @IsOptional()
  @IsUUID('all')
  storageUnitId?: string;
}
