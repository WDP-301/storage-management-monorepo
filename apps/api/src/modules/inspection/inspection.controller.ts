import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { AssignInspectionDto } from './dto/assign-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { UploadInspectionEvidenceDto } from './dto/upload-inspection-evidence.dto';
import { InspectionService } from './inspection.service';
import { InspectionLifecycleService } from './inspection-lifecycle.service';

@ApiTags('Inspections')
@Controller('inspections')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class InspectionController {
  constructor(
    private readonly inspectionService: InspectionService,
    private readonly lifecycle: InspectionLifecycleService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'List all inspections' })
  findAll() {
    return this.inspectionService.findAll();
  }

  @Get('mine')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'List inspections of my contracts' })
  getAllMyInspection(@CurrentUser() user: AuthUser) {
    return this.inspectionService.findMyInspections(user);
  }

  @Get('assigned')
  @Roles(UserRole.FACILITY_STAFF)
  @ApiOperation({ summary: 'List inspections assigned to me' })
  getAllStaffInspection(@CurrentUser() user: AuthUser) {
    return this.inspectionService.findStaffInspections(user);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.FACILITY_MANAGER,
    UserRole.FACILITY_STAFF,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get an inspection by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.inspectionService.findById(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: 'Update an inspection (assigned inspector or manager)' })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInspectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inspectionService.update(id, dto, user);
  }

  @Put(':id/evidence')
  @Roles(UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: 'Append an R2 file URL to inspection evidence' })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto })
  uploadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadInspectionEvidenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inspectionService.uploadEvidence(id, dto, user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: 'Assign a facility staff member as the inspector' })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto })
  assignStaff(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignInspectionDto) {
    return this.inspectionService.assignStaff(id, dto);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({
    summary: 'Finalize a handover inspection — activates the contract and rents the unit',
  })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto })
  finalize(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.finalize(id, user);
  }
}
