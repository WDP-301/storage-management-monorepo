import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import type { Response } from 'express';
import { BookingsService } from './bookings.service';
import {
  BookingActionResponseDto,
  BookingResponseDto,
  CreateBookingDto,
  CreateBookingResponseDto,
} from './dto/booking.dto';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(SessionGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking and hold selected units for 15 minutes' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Client-generated UUID. Retrying with the same key returns the original response.',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created — units held for 15 min',
    type: CreateBookingResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Idempotent response — booking already created',
    type: CreateBookingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or malformed Idempotency-Key header / validation failed',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Unit not available or key in PROCESSING state',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Same idempotency key reused with different payload',
    type: ApiErrorResponseDto,
  })
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthUser,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Header Idempotency-Key là bắt buộc');
    }
    // Validate UUID format (v4 or v7)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key phải là UUID hợp lệ');
    }

    const { data, isRetry } = await this.bookingsService.create(dto, user, idempotencyKey);
    res.status(isRetry ? HttpStatus.OK : HttpStatus.CREATED);
    return data;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my bookings' })
  @ApiResponse({ status: 200, type: [BookingResponseDto] })
  getMyBookings(@CurrentUser() user: AuthUser) {
    return this.bookingsService.findByCustomer(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one booking by ID — poll this while awaiting deposit payment',
  })
  @ApiResponse({ status: 200, type: BookingResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Not the booking owner',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
    type: ApiErrorResponseDto,
  })
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookingsService.findById(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking and release held units' })
  @ApiResponse({ status: 200, type: BookingActionResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Booking is not in a cancellable status',
    type: ApiErrorResponseDto,
  })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookingsService.cancel(id, user);
  }
}
