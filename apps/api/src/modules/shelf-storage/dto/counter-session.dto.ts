import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class OpenCounterSessionDto {
  @ApiProperty({ description: 'Text decoded from the customer QR code', example: 'SMCI1:…' })
  @IsString()
  @MaxLength(100)
  qrPayload: string;

  @ApiProperty({ format: 'uuid', description: 'Shelf warehouse the staff member is working at' })
  @IsUUID('all')
  warehouseId: string;
}
