import { Controller, Get, Optional } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { UploadService } from '../upload/upload.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly uploadService?: UploadService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check and database/storage readiness' })
  @ApiResponse({ status: 200, description: 'System health status' })
  async check() {
    let dbStatus = 'disconnected';
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbStatus = 'connected';
      }
    } catch {
      dbStatus = 'error';
    }

    let s3Status: any = { status: 'unconfigured' };
    if (this.uploadService) {
      s3Status = await this.uploadService.checkHealth();
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        type: 'postgres',
        status: dbStatus,
      },
      storage: {
        provider: 'rustfs (S3-compatible)',
        ...s3Status,
      },
    };
  }
}
