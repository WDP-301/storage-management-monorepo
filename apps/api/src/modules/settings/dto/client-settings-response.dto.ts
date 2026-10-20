import { ApiProperty } from '@nestjs/swagger';
import type { ClientBookingSettings, ClientSettingsResponse } from '@storage/types';

export class ClientBookingSettingsDto implements ClientBookingSettings {
  @ApiProperty({
    type: [Number],
    description: 'Terms to offer — sorted, never empty, each within min/max',
    example: [6, 12, 18],
  })
  rentalMonthsOptions: number[];

  @ApiProperty({ description: 'Pre-selected term, always one of the options', example: 6 })
  defaultRentalMonths: number;

  @ApiProperty({ example: 6 })
  minRentalMonths: number;

  @ApiProperty({ example: 60 })
  maxRentalMonths: number;

  @ApiProperty({ description: 'Max days between today and the rental start date', example: 30 })
  leadDays: number;

  @ApiProperty({ example: 4 })
  maxUnitsPerBooking: number;
}

export class ClientSettingsResponseDto implements ClientSettingsResponse {
  @ApiProperty({ type: ClientBookingSettingsDto })
  booking: ClientBookingSettingsDto;
}
