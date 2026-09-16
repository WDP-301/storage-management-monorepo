import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageItem } from './entities/storage-item.entity';
import { StorageLocation } from './entities/storage-location.entity';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([StorageItem, StorageLocation])],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
