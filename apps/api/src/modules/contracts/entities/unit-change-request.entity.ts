import { AppUser } from '@modules/customer/entities/app-user.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
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
import { ContractUnit } from './contract-unit.entity';

@Entity('unit_change_requests')
export class UnitChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_unit_id' })
  contractUnitId: string;

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

  @ManyToOne(() => ContractUnit)
  @JoinColumn({ name: 'contract_unit_id' })
  contractUnit: ContractUnit;

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
