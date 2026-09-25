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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import { CreateUnitTypeDto, UpdateUnitTypeDto } from './dto/unit-type.dto';
import { UnitTypesService } from './unit-types.service';

@ApiTags('Unit Types')
@Controller('unit-types')
export class UnitTypesController {
  constructor(private readonly unitTypesService: UnitTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List all unit types' })
  findAll() {
    return this.unitTypesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit type by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitTypesService.findById(id);
  }

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Create unit type' })
  create(@Body() dto: CreateUnitTypeDto) {
    return this.unitTypesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Update unit type' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitTypeDto) {
    return this.unitTypesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Soft-delete unit type' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitTypesService.softDelete(id);
  }
}
