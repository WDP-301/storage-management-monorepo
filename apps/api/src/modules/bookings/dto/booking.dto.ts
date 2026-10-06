import { Booking } from '@entities/booking.entity';
import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@storage/types';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsUUID,
  Max,
  Min,
  registerDecorator,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validates that requestedStartAt is from today onwards and at most 30 days in advance.
 */
export function IsValidBookingStartDate(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isValidBookingStartDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return false;

          const now = new Date();
          // Beginning of today (local time)
          const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0,
          );
          // 30 days from today (inclusive to end of the 30th day)
          const maxAdvanceDate = new Date(
            startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000 - 1),
          );

          return date >= startOfToday && date <= maxAdvanceDate;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} phải từ ngày hôm nay trở đi và tối đa trước 30 ngày`;
        },
      },
    });
  };
}

/**
 * Validates that no duplicate storage units exist in the same booking request.
 */
export function IsUniqueStorageUnits(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isUniqueStorageUnits',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(items: unknown) {
          if (!Array.isArray(items)) return true;
          const ids = items
            .map((item) => (item as Record<string, unknown>)?.storageUnitId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);
          return new Set(ids).size === ids.length;
        },
        defaultMessage() {
          return 'Không được chứa storage unit trùng lặp trong cùng một booking';
        },
      },
    });
  };
}

export class CreateBookingItemDto {
  @ApiProperty({
    example: '018f673a-4001-7000-8000-000000000001',
    description: 'Storage unit ID (UUIDv4/v7)',
  })
  @IsUUID('all')
  storageUnitId: string;

  @ApiProperty({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Requested rental start date for this unit (from today up to 30 days in advance)',
  })
  @IsDateString()
  @IsValidBookingStartDate()
  requestedStartAt: string;

  @ApiProperty({
    example: 3,
    description: 'Number of months to rent for this unit',
    minimum: 1,
    maximum: 60,
  })
  @IsInt()
  @Min(1)
  @Max(60)
  rentalMonths: number;
}

export class CreateBookingDto {
  @ApiProperty({
    type: [CreateBookingItemDto],
    description: 'List of storage units to book with individual schedules',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUniqueStorageUnits()
  @ValidateNested({ each: true })
  @Type(() => CreateBookingItemDto)
  items: CreateBookingItemDto[];
}

export class BookingItemResponseDto {
  @ApiProperty({ example: '018f673a-4001-7000-8000-000000000001' })
  storageUnitId: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  requestedStartAt: string;

  @ApiProperty({ example: 3 })
  rentalMonths: number;
}

/** Body nằm trong `data` của success envelope — xem API_CONTRACT.md. */
export class CreateBookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'BK-1759478400000-A1B2' })
  bookingNo: string;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.HOLDING })
  status: BookingStatus;

  /** Cột decimal → TypeORM trả string ("3000000.00"), không phải number. */
  @ApiProperty({ example: '3000000.00' })
  subtotal: string;

  @ApiProperty({ example: '1000000.00' })
  depositTotal: string;

  @ApiProperty({
    nullable: true,
    example:
      'https://img.vietqr.io/image/MB-0123456789-compact2.png?amount=1000000&addInfo=BK-1759478400000-A1B2&accountName=CONG+TY',
    description:
      'URL ảnh VietQR để thanh toán tiền cọc — app mobile render trực tiếp. Null khi API chưa cấu hình tài khoản ngân hàng.',
  })
  paymentQrUrl: string | null;

  @ApiProperty({
    format: 'date-time',
    description: 'Thời điểm hết hạn giữ chỗ (15 phút kể từ lúc tạo booking)',
  })
  expiresAt: Date;

  @ApiProperty({ type: [BookingItemResponseDto] })
  items: BookingItemResponseDto[];
}

/** Booking kèm thời điểm hết hạn giữ chỗ — dùng cho GET /bookings/me. */
export class BookingResponseDto extends Booking {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Thời điểm hold hết hạn (MAX expires_at của active holds) — null nếu không còn hold active',
  })
  holdExpiresAt: Date | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'URL ảnh VietQR để thanh toán tiền cọc — chỉ có khi booking đang chờ cọc (HOLDING/PENDING_DEPOSIT) và hold còn hạn; null sau khi confirm hoặc hold hết hạn.',
  })
  paymentQrUrl: string | null;
}

/** Response của cancel booking. */
export class BookingActionResponseDto {
  @ApiProperty({ example: 'Đã hủy booking và giải phóng chỗ giữ' })
  message: string;
}
