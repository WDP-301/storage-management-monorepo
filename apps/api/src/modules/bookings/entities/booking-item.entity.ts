import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('booking_items')
@Unique('UQ_booking_item_unit', ['bookingId', 'storageUnitId'])
export class BookingItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'booking_id' })
  bookingId: string;

  @Column({ type: 'uuid', name: 'storage_unit_id' })
  storageUnitId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'monthly_price_snapshot' })
  monthlyPriceSnapshot: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'deposit_snapshot' })
  depositSnapshot: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => StorageUnit)
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit: StorageUnit;
}
