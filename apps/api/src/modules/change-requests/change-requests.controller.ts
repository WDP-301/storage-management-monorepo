import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { ChangeRequestsService } from './change-requests.service';
import {
  ChangeRequestOptionsQueryDto,
  CreateChangeRequestDto,
  DecideChangeRequestDto,
  ListChangeRequestsQueryDto,
} from './dto/change-request.dto';
import type {
  ChangeRequestListResponse,
  ChangeRequestOptionsResponse,
  ChangeRequestResponse,
} from './types/change-request';

@ApiTags('Unit Change Requests')
@Controller('unit-change-requests')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({ status: 403, description: 'Not allowed', type: ApiErrorResponseDto })
export class ChangeRequestsController {
  constructor(private readonly changeRequests: ChangeRequestsService) {}

  @Get('options')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Units the contract could move to (same kind, available), with price/deposit deltas',
  })
  options(
    @Query() query: ChangeRequestOptionsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestOptionsResponse> {
    return this.changeRequests.options(query, user);
  }

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Request a move to another available unit of the same kind (any active facility)',
  })
  @ApiResponse({ status: 201, description: 'Request created' })
  create(
    @Body() dto: CreateChangeRequestDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestResponse> {
    return this.changeRequests.create(dto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary: 'List change requests visible to the caller (admin all, manager scoped, customer own)',
  })
  list(
    @Query() query: ListChangeRequestsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestListResponse> {
    return this.changeRequests.list(query, user);
  }

  @Patch(':id/decide')
  @Roles(UserRole.ADMIN, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary:
      'Approve (confirm move day, hold the target unit, bill deposit top-up) or reject a pending request',
  })
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideChangeRequestDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestResponse> {
    return this.changeRequests.decide(id, dto, user);
  }

  @Post(':id/start')
  @Roles(UserRole.ADMIN, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Mark the physical move started (APPROVED → TRANSITIONING)' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestResponse> {
    return this.changeRequests.start(id, user);
  }

  @Post(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary: 'Confirm the move is done — swaps the units and retires the old one to MAINTENANCE',
  })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestResponse> {
    return this.changeRequests.complete(id, user);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary:
      'Withdraw a request — customer while REQUESTED; manager also on approved requests (releases the held unit, voids an unpaid top-up)',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestResponse> {
    return this.changeRequests.cancel(id, user);
  }
}
