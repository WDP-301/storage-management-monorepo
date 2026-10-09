import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import { AdminFacilitiesQueryDto } from './dto/facility.dto';
import { FacilitiesService } from './facilities.service';

@ApiTags('Facilities')
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get('admin')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: '[Admin] List facilities of every status, paginated and searchable' })
  findForAdmin(@Query() query: AdminFacilitiesQueryDto) {
    return this.facilitiesService.findForAdmin(query);
  }

  @Get('mine')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF)
  @ApiOperation({ summary: 'List facilities the current user is assigned to' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.facilitiesService.findAssigned(user.id);
  }

  @Get(':id/staff')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'List active staff of a facility (for assigning inspections)' })
  findStaff(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.facilitiesService.findStaff(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get facility by ID' })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.facilitiesService.findById(id);
  }
}
