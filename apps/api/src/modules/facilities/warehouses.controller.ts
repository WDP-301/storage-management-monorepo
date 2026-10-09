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
  AdminWarehouseListQueryDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  UpdateWarehouseStatusDto,
  WarehouseListQueryDto,
} from './dto/warehouse.dto';
import { WarehouseCommandService } from './warehouse-command.service';
import { WarehouseQueryService } from './warehouse-query.service';

const BACK_OFFICE = [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER] as const;

@ApiTags('Warehouses')
@Controller('warehouses')
export class WarehousesController {
  constructor(
    private readonly queries: WarehouseQueryService,
    private readonly commands: WarehouseCommandService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Public: rentable warehouses, filterable by area, volume, price and location',
  })
  listPublic(@Query() query: WarehouseListQueryDto) {
    return this.queries.listPublic(query);
  }

  @Get('admin')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE)
  @ApiOperation({ summary: '[Admin] Every warehouse with any status, paginated' })
  listAdmin(@Query() query: AdminWarehouseListQueryDto) {
    return this.queries.listAdmin(query);
  }

  @Get('mine')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF)
  @ApiOperation({ summary: 'Warehouses the caller manages or staffs' })
  listMine(@CurrentUser() user: AuthUser) {
    return this.queries.listAssigned(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Warehouse detail (any status)' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queries.findOne(id);
  }

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE)
  @ApiOperation({ summary: '[Admin] Create a warehouse' })
  @ApiResponse({ status: 409, description: 'Code already exists' })
  create(@Body() dto: CreateWarehouseDto) {
    return this.commands.create(dto);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE)
  @ApiOperation({ summary: '[Admin] Update a warehouse' })
  @ApiResponse({ status: 409, description: 'Code, size or status of an occupied warehouse' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.commands.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Take a warehouse in or out of service (AVAILABLE ↔ MAINTENANCE)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commands.updateStatus(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Soft-delete a warehouse' })
  @ApiResponse({ status: 409, description: 'Occupied or open tour appointments remain' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.commands.softDelete(id);
  }
}
