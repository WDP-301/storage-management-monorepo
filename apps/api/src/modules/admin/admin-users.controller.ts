import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { AdminUsersService } from './admin-users.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserIdParamDto, UserRoleAssignmentParamDto } from './dto/user-params.dto';
import type {
  AdminUserListResponse,
  AdminUserResponse,
  RevokeRoleResponse,
} from './types/admin-user';

@ApiTags('Admin - Users')
@Controller('admin/users')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({
  status: 403,
  description: 'Authenticated but not an admin',
  type: ApiErrorResponseDto,
})
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List user accounts with pagination and optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  list(@Query() query: ListUsersQueryDto): Promise<AdminUserListResponse> {
    return this.adminUsers.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user account with its role assignments' })
  @ApiResponse({ status: 200, description: 'The user' })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiErrorResponseDto })
  get(@Param() params: UserIdParamDto): Promise<AdminUserResponse> {
    return this.adminUsers.getUser(params.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change a user account status' })
  @ApiResponse({ status: 200, description: 'The updated user' })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiErrorResponseDto })
  updateStatus(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') currentAdminId: string,
  ): Promise<AdminUserResponse> {
    return this.adminUsers.updateStatus(params.id, dto.status, currentAdminId);
  }

  @Post(':id/roles')
  @ApiOperation({ summary: 'Grant a role to a user' })
  @ApiResponse({ status: 201, description: 'The user with the granted role' })
  @ApiResponse({
    status: 404,
    description: 'User or facility not found',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Role already assigned', type: ApiErrorResponseDto })
  assignRole(
    @Param() params: UserIdParamDto,
    @Body() dto: AssignRoleDto,
    @CurrentUser('id') assignedBy: AuthUser['id'],
  ): Promise<AdminUserResponse> {
    return this.adminUsers.assignRole(params.id, dto, assignedBy);
  }

  @Delete(':id/roles/:assignmentId')
  @ApiOperation({ summary: 'Revoke a role assignment from a user (idempotent)' })
  @ApiResponse({ status: 200, description: 'Role assignment removed if it existed' })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiErrorResponseDto })
  revokeRole(@Param() params: UserRoleAssignmentParamDto): Promise<RevokeRoleResponse> {
    return this.adminUsers.revokeRole(params.id, params.assignmentId);
  }
}
