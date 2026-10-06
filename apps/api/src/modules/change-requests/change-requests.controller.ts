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
  CreateChangeRequestDto,
  DecideChangeRequestDto,
  ListChangeRequestsQueryDto,
} from './dto/change-request.dto';
import type { ChangeRequestListResponse, ChangeRequestResponse } from './types/change-request';

@ApiTags('Unit Change Requests')
@Controller('unit-change-requests')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({ status: 403, description: 'Not allowed', type: ApiErrorResponseDto })
export class ChangeRequestsController {
  constructor(private readonly changeRequests: ChangeRequestsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Request a move to another unit in the same facility' })
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
    summary: 'Approve or reject a pending request — approval performs the unit swap',
  })
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideChangeRequestDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ChangeRequestResponse> {
    return this.changeRequests.decide(id, dto, user);
  }
}
