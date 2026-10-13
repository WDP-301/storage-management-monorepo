import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class NotificationIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all') // 'all' supports UUIDv4 and UUIDv7 (used by DB)
  id: string;
}
