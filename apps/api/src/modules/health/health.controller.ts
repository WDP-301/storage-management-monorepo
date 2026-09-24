import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get(['', 'live'])
  @ApiOperation({ summary: 'Process liveness check' })
  check() {
    return { status: 'alive', uptime: process.uptime() };
  }
}
