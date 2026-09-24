import { Facility } from '@modules/facilities/entities/facility.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { BookingStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40, name: 'booking_no' })
  bookingNo: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'uuid', nullable: true, name: 'preferred_facility_id' })
  preferredFacilityId?: string;

  @Column({ type: 'varchar', length: 25, default: BookingStatus.DRAFT })
  status: BookingStatus;

  @Column({ type: 'timestamptz', name: 'requested_start_at' })
  requestedStartAt: Date;

  @Column({ type: 'int', name: 'rental_months' })
  rentalMonths: number;

  @Column({ type: 'char', length: 3, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'deposit_total' })
  depositTotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;

  @ManyToOne(() => Facility, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'preferred_facility_id' })
  preferredFacility?: Facility;
}
