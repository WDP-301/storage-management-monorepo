import { Booking } from '@modules/bookings/entities/booking.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { PaymentMethod, PaymentStatus, PaymentType } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40, name: 'payment_no' })
  paymentNo: string;

  @Column({ type: 'uuid', nullable: true, name: 'invoice_id' })
  invoiceId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'booking_id' })
  bookingId?: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'varchar', length: 20 })
  type: PaymentType;

  @Column({ type: 'varchar', length: 20, default: PaymentMethod.SIMULATED })
  method: PaymentMethod;

  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'provider_ref' })
  providerRef?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'paid_at' })
  paidAt?: Date;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking?: Booking;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;
}
