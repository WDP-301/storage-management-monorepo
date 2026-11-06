import { PickupRequest } from '@entities/pickup-request.entity';
import { ShelfItem } from '@entities/shelf-item.entity';
import { ShelfReceipt } from '@entities/shelf-receipt.entity';
import { ShelfReceiptLine } from '@entities/shelf-receipt-line.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CounterSessionsService } from './counter-sessions.service';
import { ReceiptVoidService } from './receipt-void.service';
import { ShelfCounterController } from './shelf-counter.controller';
import { ShelfReceiptsService } from './shelf-receipts.service';
import { ShelfRecordsController } from './shelf-records.controller';
import { ShelfRecoveryService } from './shelf-recovery.service';
import { ShelfStorageReadsService } from './shelf-storage-reads.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShelfItem, ShelfReceipt, ShelfReceiptLine, PickupRequest]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ShelfCounterController, ShelfRecordsController],
  providers: [
    CounterSessionsService,
    ShelfReceiptsService,
    ReceiptVoidService,
    ShelfRecoveryService,
    ShelfStorageReadsService,
  ],
})
export class ShelfStorageModule {}
