import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@shared/models/api-response';
import { TourAppointmentStatus } from '@storage/types';
import type {
  TourAppointmentFacilityInfo,
  TourAppointmentListResponse,
  TourAppointmentRecord,
  TourAppointmentResponse,
  TourAppointmentStorageUnitInfo,
  TourAppointmentUserInfo,
} from '../types/tour-appointment';

export class TourAppointmentFacilityInfoDto implements TourAppointmentFacilityInfo {
  @ApiProperty({ format: 'uuid', example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  id: string;

  @ApiProperty({ example: 'FAC-TD-01' })
  code: string;

  @ApiProperty({ example: 'Chi nhánh Hồ Chí Minh' })
  name: string;
}

export class TourAppointmentStorageUnitInfoDto implements TourAppointmentStorageUnitInfo {
  @ApiProperty({ format: 'uuid', example: 'f3b89098-971c-4b53-9097-f50f4a86989f' })
  id: string;

  @ApiProperty({ example: 'U-102' })
  code: string;

  @ApiProperty({ example: 'Kho Thủ Đức 40m²' })
  name: string;

  @ApiProperty({ example: 'Số 123 Đường Song Hành, TP. Thủ Đức, TP. Hồ Chí Minh' })
  addressLine: string;
}

export class TourAppointmentUserInfoDto implements TourAppointmentUserInfo {
  @ApiProperty({ format: 'uuid', example: 'c1b48b61-d703-4f93-8ef4-9e3f225d3fa2' })
  id: string;

  @ApiProperty({ example: 'Trần Văn Nhân Viên' })
  fullName: string;

  @ApiProperty({ example: 'staff.thuduc@storagehub.vn' })
  email: string;

  @ApiProperty({ nullable: true, example: '0901234567' })
  phone?: string | null;
}

export class TourAppointmentRecordDto implements TourAppointmentRecord {
  @ApiProperty({
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Mã định danh duy nhất của cuộc hẹn dẫn xem kho',
  })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: 'Mã chi nhánh khách muốn đến xem',
  })
  facilityId: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    example: null,
    description: 'Mã khách hàng trong hệ thống nếu khách đã đăng nhập trước khi gửi',
  })
  customerId?: string | null;

  @ApiProperty({
    example: 'Nguyễn Văn Khách',
    description: 'Họ và tên người liên hệ / đăng ký xem kho',
  })
  fullName: string;

  @ApiProperty({
    example: '0987654321',
    description: 'Số điện thoại liên lạc của khách',
  })
  phone: string;

  @ApiProperty({
    example: 'khachhang@example.com',
    description: 'Email liên lạc của khách',
  })
  email: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    example: 'f3b89098-971c-4b53-9097-f50f4a86989f',
    description: 'Mã kho cụ thể mà khách đang quan tâm (nếu có)',
  })
  storageUnitId?: string | null;

  @ApiProperty({
    example: '2026-10-15',
    description: 'Ngày hẹn đến xem kho (định dạng YYYY-MM-DD)',
  })
  preferredDate: string;

  @ApiProperty({
    nullable: true,
    example: '09:00 - 11:00',
    description: 'Khung giờ mong muốn đến xem',
  })
  preferredTimeSlot?: string | null;

  @ApiProperty({
    nullable: true,
    example: 'Tôi cần thuê kho diện tích khoảng 10-15m2 để chứa bàn ghế văn phòng chuyển đi',
    description: 'Ghi chú nhu cầu từ khách hàng',
  })
  customerNotes?: string | null;

  @ApiProperty({
    enum: TourAppointmentStatus,
    example: TourAppointmentStatus.CONFIRMED,
    description: 'Trạng thái cuộc hẹn: PENDING -> CONFIRMED -> ASSIGNED -> COMPLETED | CANCELLED',
  })
  status: TourAppointmentStatus;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    example: 'c1b48b61-d703-4f93-8ef4-9e3f225d3fa2',
    description: 'Mã nhân viên chi nhánh được phân công dẫn khách xem',
  })
  assignedTo?: string | null;

  @ApiProperty({
    nullable: true,
    example: 'Đã gọi điện xác nhận lúc 10h sáng, khách đồng ý lịch hẹn sáng thứ 7',
    description: 'Ghi chú tiếp nhận và điều phối của Quản lý chi nhánh (Facility Manager)',
  })
  managerNotes?: string | null;

  @ApiProperty({
    nullable: true,
    example:
      'Đã dẫn khách xem kho U-102 và U-105. Khách rất ưng ý U-102, dự kiến ký hợp đồng vào đầu tuần sau.',
    description: 'Ghi chú kết quả tư vấn của Nhân viên chi nhánh sau buổi dẫn xem',
  })
  staffResultNotes?: string | null;

  @ApiProperty({
    nullable: true,
    example: null,
    description: 'Lý do hủy lịch hẹn (nếu khách báo bận hoặc khách không đến - no show)',
  })
  cancellationReason?: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-08T04:30:00.000Z',
    description: 'Thời điểm tạo yêu cầu liên hệ',
  })
  createdAt: string | Date;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-08T05:00:00.000Z',
    description: 'Thời điểm cập nhật trạng thái gần nhất',
  })
  updatedAt: string | Date;

  @ApiProperty({ type: () => TourAppointmentFacilityInfoDto, nullable: true })
  facility?: TourAppointmentFacilityInfo | null;

  @ApiProperty({ type: () => TourAppointmentUserInfoDto, nullable: true })
  customer?: TourAppointmentUserInfo | null;

  @ApiProperty({ type: () => TourAppointmentStorageUnitInfoDto, nullable: true })
  storageUnit?: TourAppointmentStorageUnitInfo | null;

  @ApiProperty({ type: () => TourAppointmentUserInfoDto, nullable: true })
  assignee?: TourAppointmentUserInfo | null;
}

export class TourAppointmentResponseDto implements TourAppointmentResponse {
  @ApiProperty({ type: TourAppointmentRecordDto })
  appointment: TourAppointmentRecordDto;
}

export class TourAppointmentListResponseDto implements TourAppointmentListResponse {
  @ApiProperty({ type: [TourAppointmentRecordDto] })
  appointments: TourAppointmentRecordDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
