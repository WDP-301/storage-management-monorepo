import { AuditWithTimezone } from '@shared/models/audit.model';
import { StorageItemStatus } from '@storage/types';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StorageLocation } from './storage-location.entity';

@Entity('storage_items')
export class StorageItem extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true, length: 50 })
  sku: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 5, name: 'min_quantity' })
  minQuantity: number;

  @Column({ length: 30, default: 'pcs' })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price: number;

  @Column({
    type: 'enum',
    enum: StorageItemStatus,
    default: StorageItemStatus.IN_STOCK,
  })
  status: StorageItemStatus;

  @Column({ type: 'uuid', nullable: true, name: 'location_id' })
  locationId?: string;

  @ManyToOne(
    () => StorageLocation,
    (location) => location.items,
    {
      nullable: true,
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({ name: 'location_id' })
  location?: StorageLocation;
}
