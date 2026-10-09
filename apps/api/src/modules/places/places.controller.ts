import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storage/types';
import { AutocompleteQueryDto, NearbyQueryDto, PlaceDetailQueryDto } from './dto/places-query.dto';
import { PlacesService } from './places.service';

@ApiTags('Places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('autocomplete')
  @ApiOperation({
    summary: 'Autocomplete place suggestions',
    description: 'Proxy to Goong Autocomplete v2. Results cached 60s per input.',
  })
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.placesService.autocomplete(query.input);
  }

  @Get('detail')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({
    summary: '[Admin] Resolve an autocomplete place_id to address + coordinates',
    description: 'Used by the warehouse form to fill latitude/longitude from a Goong suggestion.',
  })
  detail(@Query() query: PlaceDetailQueryDto) {
    return this.placesService.resolvePlace(query.place_id);
  }

  @Get('nearby')
  @ApiOperation({
    summary: 'Find rentable warehouses near a place',
    description:
      'Returns AVAILABLE warehouses within the given radius (km) sorted by distance. Center is either a Goong place_id or raw lat/lng (e.g. user GPS).',
  })
  findNearby(@Query() query: NearbyQueryDto) {
    return this.placesService.findNearby(query);
  }
}
