import { SessionGuard } from '@modules/auth/guards/session.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import type { ClientSettingsResponse } from '@storage/types';
import { ClientSettingsResponseDto } from './dto/client-settings-response.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(SessionGuard)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
export class ClientSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('client')
  @ApiOperation({ summary: 'Admin-configured rules clients need to build their booking UI' })
  @ApiResponse({ status: 200, description: 'Client settings', type: ClientSettingsResponseDto })
  get(): Promise<ClientSettingsResponse> {
    return this.settings.getClientSettings();
  }
}
