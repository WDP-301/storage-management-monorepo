import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/amenity.dto';

@ApiTags('Amenities')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Public: active amenities in display order (pickers, filters)' })
  listActive() {
    return this.amenities.listActive();
  }

  // Declared before `:id` routes so the literal path is never read as an id.
  @Get('admin')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Every amenity, including retired ones' })
  listAll() {
    return this.amenities.listAll();
  }

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Add an amenity to the catalog' })
  @ApiResponse({ status: 409, description: 'Code already exists' })
  create(@Body() dto: CreateAmenityDto) {
    return this.amenities.create(dto);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Rename, reorder or retire an amenity (code is fixed)' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAmenityDto) {
    return this.amenities.update(id, dto);
  }
}
