import { Facility } from '@modules/facilities/entities/facility.entity';
import { UnitType } from '@modules/facilities/entities/unit-type.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { WaitlistStatus } from '@shared/models/domain.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'uuid', nullable: true, name: 'booking_id' })
  bookingId?: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'unit_type_id' })
  unitTypeId?: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true, name: 'min_price' })
  minPrice?: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true, name: 'max_price' })
  maxPrice?: number;

  @Column({ type: 'boolean', default: false, name: 'nearby_required' })
  nearbyRequired: boolean;

  @Column({ type: 'varchar', length: 20, default: WaitlistStatus.WAITING })
  status: WaitlistStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'offer_expires_at' })
  offerExpiresAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking?: Booking;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => UnitType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_type_id' })
  unitType?: UnitType;
}
