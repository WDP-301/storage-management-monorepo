import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutocompleteQueryDto, NearbyQueryDto } from './dto/places-query.dto';
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

  @Get('nearby')
  @ApiOperation({
    summary: 'Find storage facilities near a place',
    description:
      'Returns facilities within the given radius (km) sorted by distance. Center is either a Goong place_id or raw lat/lng (e.g. user GPS).',
  })
  findNearby(@Query() query: NearbyQueryDto) {
    return this.placesService.findNearby(query);
  }
}
