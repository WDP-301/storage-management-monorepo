import { Controller, Get, HttpStatus, Optional } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { DataSource } from 'typeorm';
import { UploadService } from '../upload/upload.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly uploadService?: UploadService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness check' })
  live() {
    return { status: 'alive', uptime: process.uptime() };
  }

  @Get()
  @ApiOperation({ summary: 'Backward-compatible readiness check' })
  check() {
    return this.ready();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Database and storage readiness check' })
  @ApiResponse({ status: 200, description: 'Required dependencies are ready' })
  @ApiResponse({ status: 503, description: 'A required dependency is unavailable' })
  async ready() {
    let database = 'disconnected';
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        database = 'connected';
      }
    } catch {
      database = 'error';
    }

    const storage = this.uploadService
      ? await this.uploadService.checkHealth()
      : { status: 'unconfigured' };
    const details = {
      database: { type: 'postgres', status: database },
      storage: { provider: 'cloudflare-r2 (S3-compatible)', ...storage },
    };

    if (database !== 'connected' || (this.uploadService && storage.status !== 'connected')) {
      throw new DomainException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Required dependencies are unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        details,
      );
    }

    return { status: 'ready', uptime: process.uptime(), ...details };
  }
}
