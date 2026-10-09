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
import { UserRole } from '@storage/types';
import { AdminFacilitiesQueryDto, CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';
import { FacilitiesService } from './facilities.service';
import { FacilityCommandService } from './facility-command.service';

@ApiTags('Facilities')
@Controller('facilities')
export class FacilitiesController {
  constructor(
    private readonly facilitiesService: FacilitiesService,
    private readonly commands: FacilityCommandService,
  ) {}

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: '[Admin] Create a facility (branch)' })
  @ApiResponse({ status: 409, description: 'Code already exists' })
  create(@Body() dto: CreateFacilityDto) {
    return this.commands.create(dto);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({
    summary:
      '[Admin] Update a facility. INACTIVE hides its warehouses from the catalogue, bookings and tours; running contracts are unaffected',
  })
  @ApiResponse({ status: 409, description: 'Code already exists' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFacilityDto) {
    return this.commands.update(id, dto);
  }

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
