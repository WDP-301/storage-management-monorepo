import { ApiProperty } from '@nestjs/swagger';
import type { TicketFormOptions, TicketFormOptionsResponse } from '../types/service-ticket';
import {
  TicketFacilityInfoDto,
  TicketStorageUnitInfoDto,
  TicketTypeInfoDto,
} from './ticket-response.dto';

export class TicketFacilityOptionDto extends TicketFacilityInfoDto {
  @ApiProperty({
    type: [TicketStorageUnitInfoDto],
    description:
      'Units the customer actively rents in this facility — empty for ENDED or deposit-only contracts',
  })
  units: TicketStorageUnitInfoDto[];

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Ticket type ids allowed in this facility — deposit-only customers cannot file MAINTENANCE',
  })
  typeIds: string[];
}

export class TicketFormOptionsDto implements TicketFormOptions {
  @ApiProperty({ type: [TicketTypeInfoDto] })
  types: TicketTypeInfoDto[];

  @ApiProperty({ type: [TicketFacilityOptionDto] })
  facilities: TicketFacilityOptionDto[];
}

export class ServiceTicketFormOptionsResponseDto implements TicketFormOptionsResponse {
  @ApiProperty({ type: TicketFormOptionsDto })
  options: TicketFormOptionsDto;
}
