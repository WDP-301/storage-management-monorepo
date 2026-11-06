import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { CreatePickupRequestDto, WarehousePickupQueryDto } from './dto/pickup-request.dto';
import { PickupRequestsService } from './pickup-requests.service';
import { PickupRequestsStaffService } from './pickup-requests-staff.service';

const STAFF = [
  UserRole.FACILITY_STAFF,
  UserRole.FACILITY_MANAGER,
  UserRole.OPERATIONS_MANAGER,
  UserRole.ADMIN,
] as const;

@ApiTags('Shelf pick-up requests')
@Controller('shelf-storage')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class PickupRequestsController {
  constructor(
    private readonly requests: PickupRequestsService,
    private readonly staff: PickupRequestsStaffService,
  ) {}

  @Get('contracts/:id/pickup-requests')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'The latest 20 pick-up requests of one of my shelf contracts' })
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.requests.listForContract(id, user);
  }

  @Post('contracts/:id/pickup-requests')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Ask staff to prepare goods from my shelf for a planned visit',
    description: 'Facility staff and managers are notified. One open request per contract.',
  })
  @ApiResponse({
    status: 409,
    description: 'PICKUP_REQUEST_NOT_ALLOWED or INVOICE_OVERDUE',
    type: ApiErrorResponseDto,
  })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePickupRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.create(id, dto, user);
  }

  @Post('pickup-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Cancel my pending or ready pick-up request' })
  @ApiResponse({
    status: 409,
    description: 'PICKUP_REQUEST_NOT_ALLOWED (NOT_OPEN)',
    type: ApiErrorResponseDto,
  })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.requests.cancel(id, user);
  }

  @Get('warehouses/:id/pickup-requests')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Pick-up requests of a shelf warehouse (open by default)' })
  listForWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WarehousePickupQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staff.listForWarehouse(id, query.status ?? 'OPEN', user);
  }

  @Post('pickup-requests/:id/ready')
  @HttpCode(HttpStatus.OK)
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Mark a pending request as prepared; the customer is notified' })
  @ApiResponse({
    status: 409,
    description: 'PICKUP_REQUEST_NOT_ALLOWED (NOT_PENDING)',
    type: ApiErrorResponseDto,
  })
  markReady(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.staff.markReady(id, user);
  }
}
