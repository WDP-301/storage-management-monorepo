import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { ShiftTemplateListResponseDto } from './dto/shift-template-response.dto';
import { ShiftTemplatesService } from './shift-templates.service';
import type { ShiftTemplateListResponse } from './types/shift-template';

/** Read-only view for whoever schedules staff; editing stays under admin/shift-templates. */
@ApiTags('Shift Templates')
@Controller('shift-templates')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({
  status: 403,
  description: 'Not allowed to schedule staff',
  type: ApiErrorResponseDto,
})
export class ActiveShiftTemplatesController {
  constructor(private readonly shiftTemplates: ShiftTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List the active shift templates staff can be scheduled on' })
  @ApiResponse({ status: 200, type: ShiftTemplateListResponseDto })
  listActive(): Promise<ShiftTemplateListResponse> {
    return this.shiftTemplates.listActive();
  }
}
