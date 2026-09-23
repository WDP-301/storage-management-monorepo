import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { HoldStatus } from '@shared/models/domain.enums';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from './booking.entity';

@Entity('unit_holds')
export class UnitHold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'booking_id' })
  bookingId: string;

  @Column({ type: 'uuid', name: 'storage_unit_id' })
  storageUnitId: string;

  @Column({ type: 'varchar', length: 20, default: HoldStatus.ACTIVE })
  status: HoldStatus;

  @Column({ type: 'timestamptz', name: 'held_at', default: () => 'now()' })
  heldAt: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'released_at' })
  releasedAt?: Date;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => StorageUnit)
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit: StorageUnit;
}
