import { DropOffRequest } from '@entities/drop-off-request.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DropOffRequestsController } from './drop-off-requests.controller';
import { DropOffRequestsService } from './drop-off-requests.service';
import { DropOffRequestsStaffService } from './drop-off-requests-staff.service';

@Module({
  imports: [TypeOrmModule.forFeature([DropOffRequest]), AuthModule, NotificationsModule],
  controllers: [DropOffRequestsController],
  providers: [DropOffRequestsService, DropOffRequestsStaffService],
})
export class ShelfDropOffModule {}
