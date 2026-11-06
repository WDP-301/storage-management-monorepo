import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { ShiftTemplateIdParamDto } from './dto/shift-template-params.dto';
import {
  ShiftTemplateListResponseDto,
  ShiftTemplateResponseDto,
} from './dto/shift-template-response.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { ShiftTemplatesService } from './shift-templates.service';
import type { ShiftTemplateListResponse, ShiftTemplateResponse } from './types/shift-template';

@ApiTags('Admin - Shift Templates')
@Controller('admin/shift-templates')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({
  status: 403,
  description: 'Authenticated but not an admin',
  type: ApiErrorResponseDto,
})
export class ShiftTemplatesController {
  constructor(private readonly shiftTemplates: ShiftTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all shift templates, active and inactive, by start time' })
  @ApiResponse({ status: 200, type: ShiftTemplateListResponseDto })
  list(): Promise<ShiftTemplateListResponse> {
    return this.shiftTemplates.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a shift template' })
  @ApiResponse({ status: 201, type: ShiftTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'SHIFT_TEMPLATE_CODE_TAKEN or SHIFT_TEMPLATE_OVERLAP',
    type: ApiErrorResponseDto,
  })
  create(@Body() dto: CreateShiftTemplateDto): Promise<ShiftTemplateResponse> {
    return this.shiftTemplates.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, retime, activate or deactivate a shift template' })
  @ApiResponse({ status: 200, type: ShiftTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input', type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Shift template not found', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'SHIFT_TEMPLATE_OVERLAP',
    type: ApiErrorResponseDto,
  })
  update(
    @Param() params: ShiftTemplateIdParamDto,
    @Body() dto: UpdateShiftTemplateDto,
  ): Promise<ShiftTemplateResponse> {
    return this.shiftTemplates.update(params.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a shift template; returns the deleted template' })
  @ApiResponse({ status: 200, type: ShiftTemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Shift template not found', type: ApiErrorResponseDto })
  remove(@Param() params: ShiftTemplateIdParamDto): Promise<ShiftTemplateResponse> {
    return this.shiftTemplates.remove(params.id);
  }
}
