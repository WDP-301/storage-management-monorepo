import { Booking } from '@modules/bookings/entities/booking.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { ContractStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40, name: 'contract_no' })
  contractNo: string;

  @Column({ type: 'uuid', nullable: true, name: 'booking_id' })
  bookingId?: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'varchar', length: 25, default: ContractStatus.DRAFT })
  status: ContractStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'signed_at' })
  signedAt?: Date;

  @Column({ type: 'timestamptz', name: 'effective_at' })
  effectiveAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'ended_at' })
  endedAt?: Date;

  @Column({ type: 'jsonb', default: () => "'{}'", name: 'terms_snapshot' })
  termsSnapshot: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'", name: 'customer_snapshot' })
  customerSnapshot: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking?: Booking;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;
}
