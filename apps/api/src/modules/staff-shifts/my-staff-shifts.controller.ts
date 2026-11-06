import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { StaffShiftIdParamDto } from './dto/staff-shift-params.dto';
import { StaffShiftListResponseDto, StaffShiftResponseDto } from './dto/staff-shift-response.dto';
import { MyStaffShiftsService } from './my-staff-shifts.service';
import type { StaffShiftListResponse, StaffShiftResponse } from './types/staff-shift';

@ApiTags('My Staff Shifts')
@Controller('me/staff-shifts')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.FACILITY_STAFF)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({ status: 403, description: 'Not a facility staff member', type: ApiErrorResponseDto })
export class MyStaffShiftsController {
  constructor(private readonly myShifts: MyStaffShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'My shifts between two work dates (at most 31 days)' })
  @ApiResponse({ status: 200, type: StaffShiftListResponseDto })
  list(
    @Query() query: DateRangeQueryDto,
    @CurrentUser() staff: AuthUser,
  ): Promise<StaffShiftListResponse> {
    return this.myShifts.list(query, staff);
  }

  @Patch(':id/check-in')
  @ApiOperation({ summary: 'Check in, from 30 minutes before the shift until it ends' })
  @ApiResponse({ status: 200, type: StaffShiftResponseDto })
  @ApiResponse({ status: 404, description: 'Not one of my shifts', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'STAFF_SHIFT_CHECK_IN_NOT_ALLOWED',
    type: ApiErrorResponseDto,
  })
  checkIn(
    @Param() params: StaffShiftIdParamDto,
    @CurrentUser() staff: AuthUser,
  ): Promise<StaffShiftResponse> {
    return this.myShifts.checkIn(params.id, staff);
  }

  @Patch(':id/check-out')
  @ApiOperation({ summary: 'Check out of a shift I checked in to' })
  @ApiResponse({ status: 200, type: StaffShiftResponseDto })
  @ApiResponse({ status: 404, description: 'Not one of my shifts', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'STAFF_SHIFT_CHECK_OUT_NOT_ALLOWED',
    type: ApiErrorResponseDto,
  })
  checkOut(
    @Param() params: StaffShiftIdParamDto,
    @CurrentUser() staff: AuthUser,
  ): Promise<StaffShiftResponse> {
    return this.myShifts.checkOut(params.id, staff);
  }
}
