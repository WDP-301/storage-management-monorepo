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
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import { DeleteLayoutQueryDto, SaveLayoutDto } from './layout.dto';
import { LayoutService } from './layout.service';

const EDITORS = [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER] as const;

@ApiTags('Warehouses')
@Controller('warehouses')
export class LayoutController {
  constructor(private readonly layouts: LayoutService) {}

  @Get(':id/layout')
  @ApiOperation({
    summary: 'Public: floor plan of a shelf warehouse with live shelf status, or layout null',
  })
  @ApiResponse({ status: 404, description: 'Not a shelf warehouse' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.layouts.getLayout(id);
  }

  @Get(':id/layout/admin')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Floor plan including retired shelves and the last editor' })
  @ApiResponse({ status: 403, description: 'Facility manager of another facility' })
  getAdmin(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.layouts.getLayout(id, user);
  }

  @Put(':id/layout')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...EDITORS)
  @ApiOperation({ summary: 'Save the whole floor plan; version+1 on success' })
  @ApiResponse({ status: 400, description: 'Plan invalid; details.fields lists every problem' })
  @ApiResponse({ status: 409, description: 'LAYOUT_VERSION_MISMATCH: reload and retry' })
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveLayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.layouts.save(id, dto, user);
  }

  @Delete(':id/layout')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...EDITORS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the floor plan; shelves are unaffected' })
  @ApiResponse({ status: 404, description: 'No layout' })
  @ApiResponse({ status: 409, description: 'LAYOUT_VERSION_MISMATCH' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteLayoutQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.layouts.remove(id, query.version, user);
  }

  @Post(':id/layout/draft')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...EDITORS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Propose a plan from shelf codes (one row per prefix); not saved' })
  @ApiResponse({ status: 409, description: 'Too many shelves for an automatic draft' })
  draft(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.layouts.draft(id, user);
  }
}
