import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelTourAppointmentDto {
  @ApiProperty({
    example:
      'Đã trực tại sảnh đợi khách hơn 30 phút, gọi 3 cuộc khách không bắt máy và không đến (No-show).',
    description:
      '(Bắt buộc) Lý do hủy cuộc hẹn (ví dụ: khách đổi ý, khách báo bận hoặc khách không đến)',
  })
  @IsString()
  @IsNotEmpty()
  cancellationReason: string;
}
