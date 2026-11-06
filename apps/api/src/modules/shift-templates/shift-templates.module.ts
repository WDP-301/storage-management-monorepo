import { ShiftTemplate } from '@entities/shift-template.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveShiftTemplatesController } from './active-shift-templates.controller';
import { ShiftTemplatesController } from './shift-templates.controller';
import { ShiftTemplatesService } from './shift-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShiftTemplate]), AuthModule],
  controllers: [ShiftTemplatesController, ActiveShiftTemplatesController],
  providers: [ShiftTemplatesService],
})
export class ShiftTemplatesModule {}
