import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { AutoScheduleService } from './auto-schedule.service';
import { AutoScheduleDto } from './dto/auto-schedule.dto';
import { CreateStaffShiftsDto } from './dto/create-staff-shifts.dto';
import { ListStaffShiftsQueryDto } from './dto/list-staff-shifts-query.dto';
import { StaffShiftIdParamDto } from './dto/staff-shift-params.dto';
import {
  AutoScheduleResponseDto,
  StaffShiftListResponseDto,
  StaffShiftResponseDto,
} from './dto/staff-shift-response.dto';
import { UpdateStaffShiftDto } from './dto/update-staff-shift.dto';
import { StaffShiftsService } from './staff-shifts.service';
import type {
  AutoScheduleResponse,
  StaffShiftListResponse,
  StaffShiftResponse,
} from './types/staff-shift';

@ApiTags('Staff Shifts')
@Controller('staff-shifts')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({
  status: 403,
  description: 'Not a scheduler, or a facility manager of another facility',
  type: ApiErrorResponseDto,
})
export class StaffShiftsController {
  constructor(
    private readonly staffShifts: StaffShiftsService,
    private readonly autoSchedule: AutoScheduleService,
  ) {}

  @Get()
  @ApiOperation({ summary: "A facility's shifts between two work dates (at most 31 days)" })
  @ApiResponse({ status: 200, type: StaffShiftListResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid range', type: ApiErrorResponseDto })
  list(
    @Query() query: ListStaffShiftsQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<StaffShiftListResponse> {
    return this.staffShifts.list(query, actor);
  }

  @Post()
  @ApiOperation({ summary: 'Schedule staff on a shift for several dates, all or nothing' })
  @ApiResponse({ status: 201, type: StaffShiftListResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Inactive shift, staff of another facility, or a shift already started',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({ status: 409, description: 'STAFF_SHIFT_OVERLAP', type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateStaffShiftsDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<StaffShiftListResponse> {
    return this.staffShifts.create(dto, actor);
  }

  @Post('auto-schedule')
  @ApiOperation({
    summary: "Fill each day's shifts up to the required headcount, spreading shifts evenly",
  })
  @ApiResponse({ status: 201, type: AutoScheduleResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid range or inactive shift',
    type: ApiErrorResponseDto,
  })
  autoScheduleShifts(
    @Body() dto: AutoScheduleDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AutoScheduleResponse> {
    return this.autoSchedule.run(dto, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Move a shift that has not started, or edit its note' })
  @ApiResponse({ status: 200, type: StaffShiftResponseDto })
  @ApiResponse({ status: 404, description: 'Shift not found', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'STAFF_SHIFT_LOCKED or STAFF_SHIFT_OVERLAP',
    type: ApiErrorResponseDto,
  })
  update(
    @Param() params: StaffShiftIdParamDto,
    @Body() dto: UpdateStaffShiftDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<StaffShiftResponse> {
    return this.staffShifts.update(params.id, dto, actor);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a shift that has not started' })
  @ApiResponse({ status: 200, type: StaffShiftResponseDto })
  @ApiResponse({ status: 404, description: 'Shift not found', type: ApiErrorResponseDto })
  @ApiResponse({ status: 409, description: 'STAFF_SHIFT_LOCKED', type: ApiErrorResponseDto })
  cancel(
    @Param() params: StaffShiftIdParamDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<StaffShiftResponse> {
    return this.staffShifts.cancel(params.id, actor);
  }
}
