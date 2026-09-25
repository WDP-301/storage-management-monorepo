import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'List all provinces/cities (post-2025 34-unit model)' })
  listProvinces() {
    return this.locations.listProvinces();
  }

  @Get('provinces/:code/wards')
  @ApiOperation({ summary: 'List wards/communes belonging to a province' })
  listWards(@Param('code') code: string) {
    return this.locations.listWards(code);
  }
}
