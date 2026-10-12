import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import { BulkCreateShelvesDto, CreateShelfDto } from './dto/shelf.dto';
import { ShelfCommandService } from './shelf-command.service';
import { WarehouseQueryService } from './warehouse-query.service';

const BACK_OFFICE = [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER] as const;

@ApiTags('Warehouses')
@Controller('warehouses')
export class ShelvesController {
  constructor(
    private readonly queries: WarehouseQueryService,
    private readonly commands: ShelfCommandService,
  ) {}

  @Get(':id/shelves')
  @ApiOperation({ summary: 'Public: shelves of a shelf warehouse, retired ones hidden' })
  @ApiResponse({ status: 404, description: 'Not a shelf warehouse' })
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.queries.listShelves(id, { includeInactive: false });
  }

  @Get(':id/shelves/admin')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Every live shelf of a shelf warehouse, retired ones included' })
  @ApiResponse({ status: 403, description: 'Facility manager of another facility' })
  listAll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.queries.listShelves(id, { includeInactive: true, actor: user });
  }

  @Post(':id/shelves')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE)
  @ApiOperation({ summary: '[Admin] Add a shelf; location is copied from the shelf warehouse' })
  @ApiResponse({ status: 409, description: 'Code already exists' })
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateShelfDto) {
    return this.commands.createShelf(id, dto);
  }

  @Post(':id/shelves/bulk')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BACK_OFFICE)
  @ApiOperation({ summary: '[Admin] Add a numbered run of identical shelves in one transaction' })
  @ApiResponse({ status: 409, description: 'A generated code already exists; nothing is created' })
  bulkCreate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkCreateShelvesDto) {
    return this.commands.bulkCreate(id, dto);
  }
}
