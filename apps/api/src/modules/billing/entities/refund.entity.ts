import { AppUser } from '@modules/users/entities/app-user.entity';
import { RefundStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Deposit } from './deposit.entity';
import { Payment } from './payment.entity';

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40, name: 'refund_no' })
  refundNo: string;

  @Column({ type: 'uuid', nullable: true, name: 'deposit_id' })
  depositId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'payment_id' })
  paymentId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy?: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: RefundStatus.PENDING })
  status: RefundStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'processed_at' })
  processedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Deposit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deposit_id' })
  deposit?: Deposit;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver?: AppUser;
}
