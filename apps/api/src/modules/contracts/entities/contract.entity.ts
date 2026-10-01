import { BookingItem } from '@modules/bookings/entities/booking-item.entity';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { ContractKind, ContractStatus } from '@storage/types';
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

  @Column({ type: 'uuid', name: 'booking_item_id' })
  bookingItemId: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'varchar', length: 20, default: ContractKind.INITIAL })
  kind: ContractKind;

  @Column({ type: 'varchar', length: 25, default: ContractStatus.DRAFT })
  status: ContractStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'signed_at' })
  signedAt?: Date;

  @Column({ type: 'timestamptz', name: 'effective_at' })
  effectiveAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'ended_at' })
  endedAt?: Date;

  @Column({ type: 'int', default: 1 })
  months: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'monthly_price_snapshot' })
  monthlyPriceSnapshot: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'rent_total' })
  rentTotal: number;

  @Column({ type: 'jsonb', default: () => "'{}'", name: 'terms_snapshot' })
  termsSnapshot: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'", name: 'customer_snapshot' })
  customerSnapshot: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => BookingItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_item_id' })
  bookingItem: BookingItem;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;
}
