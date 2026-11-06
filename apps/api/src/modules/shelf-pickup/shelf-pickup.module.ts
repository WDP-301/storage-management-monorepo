import { PickupRequest } from '@entities/pickup-request.entity';
import { ShelfItem } from '@entities/shelf-item.entity';
import { ShelfReceipt } from '@entities/shelf-receipt.entity';
import { ShelfReceiptLine } from '@entities/shelf-receipt-line.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PickupRequestsController } from './pickup-requests.controller';
import { PickupRequestsService } from './pickup-requests.service';
import { PickupRequestsStaffService } from './pickup-requests-staff.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShelfItem, ShelfReceipt, ShelfReceiptLine, PickupRequest]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [PickupRequestsController],
  providers: [PickupRequestsService, PickupRequestsStaffService],
})
export class ShelfPickupModule {}
