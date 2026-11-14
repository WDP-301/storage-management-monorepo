import { ApiProperty } from '@nestjs/swagger';
import type {
  ClientBookingSettings,
  ClientReturnSettings,
  ClientSettingsResponse,
  ClientUnitChangeSettings,
} from '@storage/types';

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

export class ClientReturnSettingsDto implements ClientReturnSettings {
  @ApiProperty({
    description: 'Days of notice needed to return early without losing one month of rent',
    example: 30,
  })
  noticeDays: number;

  @ApiProperty({
    description: "Per-day overstay charge as a percentage of one day's rent (monthly rent / 30)",
    example: 100,
  })
  overduePenaltyPercent: number;
}

export class ClientUnitChangeSettingsDto implements ClientUnitChangeSettings {
  @ApiProperty({
    description: 'Earliest move day, in days after today (0 = today, at a future in-shift time)',
    example: 1,
  })
  minLeadDays: number;

  @ApiProperty({
    description: 'Furthest move day, in days after today — never below minLeadDays',
    example: 90,
  })
  maxDaysAhead: number;
}

export class ClientSettingsResponseDto implements ClientSettingsResponse {
  @ApiProperty({ type: ClientBookingSettingsDto })
  booking: ClientBookingSettingsDto;

  @ApiProperty({ type: ClientReturnSettingsDto })
  return: ClientReturnSettingsDto;

  @ApiProperty({ type: ClientUnitChangeSettingsDto })
  unitChange: ClientUnitChangeSettingsDto;
}
