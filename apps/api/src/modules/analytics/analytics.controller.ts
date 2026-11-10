import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { FacilityKpisService } from './facility-kpis.service';
import type { FacilityKpisResponse } from './types/facility-kpis';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class AnalyticsController {
  constructor(private readonly kpis: FacilityKpisService) {}

  @Get('facility-kpis')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary:
      'Branch business KPIs: occupancy, monthly revenue, overdue receivables, expiring contracts',
    description:
      'FACILITY_MANAGER must pass a facilityId they manage (or omit it to aggregate all their ' +
      'facilities). ADMIN and OPERATIONS_MANAGER may omit it to aggregate every active facility.',
  })
  async facilityKpis(
    @Query('facilityId') facilityId: string | undefined,
    @CurrentUser() actor: AuthUser,
  ): Promise<FacilityKpisResponse> {
    return this.kpis.getKpis(facilityId, actor);
  }
}
