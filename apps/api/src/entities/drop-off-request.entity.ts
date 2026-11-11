import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { DropOffRequestStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface DropOffRequestLine {
  /** Null = an item the shelf does not hold yet. */
  itemId: string | null;
  name: string;
  quantity: number;
}

/**
 * A customer's notice, made ahead in the app, that they will bring goods to the shelf. At most
 * one is open (PENDING or CONFIRMED) per contract. Stock changes only with the drop-off receipt
 * that completes it. A cancelled row with no `cancelledBy` was cancelled by the system.
 */
@Entity('drop_off_requests')
// The one-open-request partial index and the DESC lookup index are created in the migration.
@Index('UQ_drop_off_requests_open_contract', { synchronize: false })
@Index('IDX_drop_off_requests_contract_created', { synchronize: false })
export class DropOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'timestamptz', name: 'requested_for' })
  requestedFor: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  /** Item names are snapshots of what the customer announced. */
  @Column({ type: 'jsonb' })
  lines: DropOffRequestLine[];

  @Column({ type: 'varchar', length: 12, default: DropOffRequestStatus.PENDING })
  status: DropOffRequestStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'confirmed_at' })
  confirmedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'confirmed_by' })
  confirmedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'cancelled_by' })
  cancelledBy: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Contract, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => AppUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedByUser: AppUser | null;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelled_by' })
  cancelledByUser: AppUser | null;
}
