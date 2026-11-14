import { AppUser } from '@entities/app-user.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { ChangeRequestStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';

@Entity('unit_change_requests')
export class UnitChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'uuid', name: 'old_unit_id' })
  oldUnitId: string;

  @Column({ type: 'uuid', nullable: true, name: 'new_unit_id' })
  newUnitId?: string;

  @Column({ type: 'uuid', name: 'requested_by' })
  requestedBy: string;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy?: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  requirements: Record<string, any>;

  @Column({ type: 'varchar', length: 25, default: ChangeRequestStatus.REQUESTED })
  status: ChangeRequestStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'transition_start_at' })
  transitionStartAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'transition_end_at' })
  transitionEndAt?: Date;

  /** The agreed move day — proposed by the customer, confirmed or adjusted by the approver. */
  @Column({ type: 'timestamptz', nullable: true, name: 'move_at' })
  moveAt?: Date;

  /** DEPOSIT_TOPUP invoice issued on approval; voided if the request is cancelled unpaid. */
  @Column({ type: 'uuid', nullable: true, name: 'topup_invoice_id' })
  topupInvoiceId?: string;

  /** Destination contract minted at settlement (the booking-like DRAFT contract for the new unit). */
  @Column({ type: 'uuid', nullable: true, name: 'new_contract_id' })
  newContractId?: string | null;

  /** Destination booking created at settlement — carries the destination handovers. */
  @Column({ type: 'uuid', nullable: true, name: 'new_booking_id' })
  newBookingId?: string | null;

  /** When the old contract was cancelled and the destination contract created. */
  @Column({ type: 'timestamptz', nullable: true, name: 'settled_at' })
  settledAt?: Date | null;

  /** The manager who gave the final approval that completed the move. */
  @Column({ type: 'uuid', nullable: true, name: 'final_approved_by' })
  finalApprovedBy?: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'final_approved_at' })
  finalApprovedAt?: Date | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'rent_difference' })
  rentDifference: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'deposit_difference' })
  depositDifference: number;

  @Column({ type: 'text', nullable: true, name: 'decision_note' })
  decisionNote?: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: any[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => StorageUnit)
  @JoinColumn({ name: 'old_unit_id' })
  oldUnit: StorageUnit;

  @ManyToOne(() => StorageUnit, { nullable: true })
  @JoinColumn({ name: 'new_unit_id' })
  newUnit?: StorageUnit;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'requested_by' })
  requester: AppUser;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver?: AppUser;
}
