import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { FacilityKpisService } from './facility-kpis.service';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [FacilityKpisService],
})
export class AnalyticsModule {}
