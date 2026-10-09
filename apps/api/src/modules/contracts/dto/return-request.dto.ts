import { IsValidBookingStartDate } from '@modules/bookings/dto/booking.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReturnRequestDto {
  @ApiProperty({ example: '2027-04-12T00:00:00.000Z', description: 'Requested move-out date' })
  @IsDateString()
  @IsValidBookingStartDate()
  scheduledAt: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
