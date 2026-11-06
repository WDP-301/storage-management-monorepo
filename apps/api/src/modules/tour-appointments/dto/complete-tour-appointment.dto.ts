import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class CompleteTourAppointmentDto {
  @ApiProperty({
    example:
      'Đã đón và dẫn khách tham quan phòng U-102 và U-105. Khách hài lòng về độ sạch và hệ thống camera an ninh, dự kiến gửi đồ vào thứ 2 tuần tới.',
    description:
      '(Bắt buộc) Ghi chú kết quả buổi dẫn khách xem phòng (phản hồi của khách, nhu cầu tiếp theo)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  staffResultNotes: string;
}
