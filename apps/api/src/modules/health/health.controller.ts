import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckResponseDto } from './dto/health.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get(['', 'live'])
  @ApiOperation({ summary: 'Process liveness check' })
  @ApiResponse({ status: 200, type: HealthCheckResponseDto })
  check() {
    return { status: 'alive', uptime: process.uptime() };
  }
}
