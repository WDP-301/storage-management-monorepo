import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import {
  CreateStorageUnitDto,
  ManagedUnitsQueryDto,
  QueryStorageUnitsDto,
  StorageUnitListResponseDto,
  UpdateStorageUnitDto,
  UpdateUnitStatusDto,
} from './dto/storage-unit.dto';
import { StorageUnitsService } from './storage-units.service';

@ApiTags('Storage Units')
@Controller('storage-units')
export class StorageUnitsController {
  constructor(private readonly storageUnitsService: StorageUnitsService) {}

  @Get()
  @ApiOperation({ summary: 'Public: browse available storage units' })
  @ApiResponse({ status: 200, type: StorageUnitListResponseDto })
  findAll(@Query() query: QueryStorageUnitsDto) {
    return this.storageUnitsService.findAll(query);
  }

  @Get('managed')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.FACILITY_MANAGER,
    UserRole.FACILITY_STAFF,
  )
  @ApiOperation({
    summary: 'Unit inventory of a facility the caller is assigned to (all statuses)',
  })
  @ApiResponse({ status: 200, type: StorageUnitListResponseDto })
  findManaged(@Query() query: ManagedUnitsQueryDto, @CurrentUser() user: AuthUser) {
    return this.storageUnitsService.findManaged(query, user);
  }

  @Patch(':id/status')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Toggle a unit between AVAILABLE and MAINTENANCE' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storageUnitsService.updateStatus(id, dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get storage unit by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.storageUnitsService.findById(id);
  }

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: '[OPERATIONS_MANAGER] Create storage unit' })
  create(@Body() dto: CreateStorageUnitDto) {
    return this.storageUnitsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: '[OPERATIONS_MANAGER] Update storage unit' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStorageUnitDto) {
    return this.storageUnitsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[OPERATIONS_MANAGER] Soft-delete storage unit' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.storageUnitsService.softDelete(id);
  }
}
