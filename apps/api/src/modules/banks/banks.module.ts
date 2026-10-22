import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { BanksController } from './banks.controller';
import { BanksService } from './banks.service';
import { HoldstationClient } from './holdstation.client';

@Module({
  imports: [AuthModule],
  controllers: [BanksController],
  providers: [BanksService, HoldstationClient],
  exports: [BanksService],
})
export class BanksModule {}
