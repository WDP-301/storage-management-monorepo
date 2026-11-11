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
import { DropOffRequestsService } from './drop-off-requests.service';
import { DropOffRequestsStaffService } from './drop-off-requests-staff.service';
import { CreateDropOffRequestDto, WarehouseDropOffQueryDto } from './dto/drop-off-request.dto';

const STAFF = [
  UserRole.FACILITY_STAFF,
  UserRole.FACILITY_MANAGER,
  UserRole.OPERATIONS_MANAGER,
  UserRole.ADMIN,
] as const;

@ApiTags('Shelf drop-off requests')
@Controller('shelf-storage')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class DropOffRequestsController {
  constructor(
    private readonly requests: DropOffRequestsService,
    private readonly staff: DropOffRequestsStaffService,
  ) {}

  @Get('contracts/:id/drop-off-requests')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'The latest 20 drop-off requests of one of my shelf contracts' })
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.requests.listForContract(id, user);
  }

  @Post('contracts/:id/drop-off-requests')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Tell staff ahead what I will bring to my shelf and when',
    description:
      'Facility staff and managers are notified. One open request per contract. Each line is an item already on the shelf (itemId) or a new one (name). Stock changes only with the drop-off receipt at the counter.',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description:
      'DROP_OFF_REQUEST_NOT_ALLOWED (CONTRACT_NOT_ACTIVE, OPEN_REQUEST_EXISTS, BEFORE_CONTRACT_START, ITEM_NOT_IN_CONTRACT) or INVOICE_OVERDUE',
    type: ApiErrorResponseDto,
  })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDropOffRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.create(id, dto, user);
  }

  @Post('drop-off-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Cancel my pending or confirmed drop-off request; staff are notified' })
  @ApiResponse({
    status: 409,
    description: 'DROP_OFF_REQUEST_NOT_ALLOWED (NOT_OPEN)',
    type: ApiErrorResponseDto,
  })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.requests.cancel(id, user);
  }

  @Get('warehouses/:id/drop-off-requests')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Drop-off requests of a shelf warehouse (open by default)' })
  listForWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WarehouseDropOffQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staff.listForWarehouse(id, query.status ?? 'OPEN', user);
  }

  @Post('drop-off-requests/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Confirm a pending request; the customer is notified' })
  @ApiResponse({
    status: 409,
    description: 'DROP_OFF_REQUEST_NOT_ALLOWED (NOT_PENDING, CONTRACT_NOT_ACTIVE)',
    type: ApiErrorResponseDto,
  })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.staff.confirm(id, user);
  }
}
