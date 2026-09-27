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
      'Resolves a Goong place_id to lat/lng, then returns facilities within the given radius (km) sorted by distance.',
  })
  findNearby(@Query() query: NearbyQueryDto) {
    return this.placesService.findNearby(query.place_id, query.radius ?? 5);
  }
}
