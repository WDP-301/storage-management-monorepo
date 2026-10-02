import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';
import type { SystemSettingsResponse, UpdateSettingsResponse } from './types/settings';

@ApiTags('Admin - Settings')
@Controller('admin/settings')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({
  status: 403,
  description: 'Authenticated but not an admin',
  type: ApiErrorResponseDto,
})
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all system settings with their current values' })
  @ApiResponse({ status: 200, description: 'All system settings' })
  list(): Promise<SystemSettingsResponse> {
    return this.settings.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Update one or more system settings' })
  @ApiResponse({ status: 200, description: 'The updated settings' })
  @ApiResponse({
    status: 400,
    description: 'Invalid setting key or value',
    type: ApiErrorResponseDto,
  })
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<UpdateSettingsResponse> {
    return this.settings.update(dto.values, admin);
  }
}
