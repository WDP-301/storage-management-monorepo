import { AuthModule } from '@modules/auth/auth.module';
import { FacilitiesModule } from '@modules/facilities/facilities.module';
import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  imports: [AuthModule, FacilitiesModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
