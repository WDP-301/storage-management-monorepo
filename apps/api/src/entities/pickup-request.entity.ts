import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { PickupRequestStatus } from '@storage/types';
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

export interface PickupRequestLine {
  itemId: string;
  name: string;
  quantity: number;
}

/**
 * A customer's request, made ahead in the app, to collect goods from the shelf. At most one is
 * open (PENDING or READY) per contract. A cancelled row with no `cancelledBy` was cancelled by
 * the system when the return was finalized.
 */
@Entity('pickup_requests')
// The one-open-request partial index and the DESC lookup index are created in the migration.
@Index('UQ_pickup_requests_open_contract', { synchronize: false })
@Index('IDX_pickup_requests_contract_created', { synchronize: false })
export class PickupRequest {
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

  /** Item names are snapshots; the live quantity is read from stock when the request is shown. */
  @Column({ type: 'jsonb' })
  lines: PickupRequestLine[];

  @Column({ type: 'varchar', length: 12, default: PickupRequestStatus.PENDING })
  status: PickupRequestStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'ready_at' })
  readyAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'ready_by' })
  readyBy: string | null;

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
  @JoinColumn({ name: 'ready_by' })
  readyByUser: AppUser | null;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelled_by' })
  cancelledByUser: AppUser | null;
}
