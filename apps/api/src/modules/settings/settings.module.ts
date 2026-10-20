import { SystemSetting } from '@entities/system-setting.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientSettingsController } from './client-settings.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting]), AuthModule],
  controllers: [SettingsController, ClientSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
