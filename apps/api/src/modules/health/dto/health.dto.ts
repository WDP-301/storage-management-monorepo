import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'alive' })
  status: string;

  @ApiProperty({ example: 123.45, description: 'Process uptime in seconds' })
  uptime: number;
}
