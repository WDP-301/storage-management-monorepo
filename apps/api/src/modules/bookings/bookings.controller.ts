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
import type { Response } from 'express';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/booking.dto';

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
  @ApiResponse({ status: 201, description: 'Booking created — units held for 15 min' })
  @ApiResponse({ status: 200, description: 'Idempotent response — booking already created' })
  @ApiResponse({ status: 409, description: 'Unit not available or key in PROCESSING state' })
  @ApiResponse({ status: 422, description: 'Same idempotency key reused with different payload' })
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
  getMyBookings(@CurrentUser() user: AuthUser) {
    return this.bookingsService.findByCustomer(user.id);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm booking after deposit payment' })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookingsService.confirm(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking and release held units' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookingsService.cancel(id, user);
  }
}
