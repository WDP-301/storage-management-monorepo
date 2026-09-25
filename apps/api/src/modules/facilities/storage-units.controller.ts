import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
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
  QueryStorageUnitsDto,
  UpdateStorageUnitDto,
} from './dto/storage-unit.dto';
import { StorageUnitsService } from './storage-units.service';

@ApiTags('Storage Units')
@Controller('storage-units')
export class StorageUnitsController {
  constructor(private readonly storageUnitsService: StorageUnitsService) {}

  @Get()
  @ApiOperation({ summary: 'Public: browse available storage units' })
  findAll(@Query() query: QueryStorageUnitsDto) {
    return this.storageUnitsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get storage unit by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.storageUnitsService.findById(id);
  }

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: '[OPERATIONS_MANAGER] Create storage unit' })
  create(@Body() dto: CreateStorageUnitDto) {
    return this.storageUnitsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: '[OPERATIONS_MANAGER] Update storage unit' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStorageUnitDto) {
    return this.storageUnitsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.OPERATIONS_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[OPERATIONS_MANAGER] Soft-delete storage unit' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.storageUnitsService.softDelete(id);
  }
}
