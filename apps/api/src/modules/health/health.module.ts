import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { HealthController } from './health.controller';

@Module({
  imports: [UploadModule],
  controllers: [HealthController],
})
export class HealthModule {}
