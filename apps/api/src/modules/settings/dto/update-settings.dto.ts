import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({
    type: Object,
    description: 'Map of setting key to its new value, e.g. { "booking.hold_minutes": 10 }',
    example: { 'booking.hold_minutes': 10 },
  })
  @IsObject()
  values: Record<string, unknown>;
}
