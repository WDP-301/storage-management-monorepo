import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { ContractRenewalStatus } from '@storage/types';
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

/**
 * A customer's request to extend an ACTIVE contract by `months` at its current monthly price.
 * Approval adds the months to the contract (the term end, rent periods and overstay follow);
 * `previousMonths` keeps the term it replaced. At most one PENDING request per contract.
 * `decidedAt` is set for every decided status, including a customer's own cancel.
 */
@Entity('contract_renewals')
// The pending-request partial unique index and the list index are created in migrations.
@Index('UQ_contract_renewals_pending', { synchronize: false })
@Index('IDX_contract_renewals_status_created', { synchronize: false })
export class ContractRenewal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'int' })
  months: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 12, default: ContractRenewalStatus.PENDING })
  status: ContractRenewalStatus;

  @Column({ type: 'int', nullable: true, name: 'previous_months' })
  previousMonths: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'decision_note' })
  decisionNote: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'decided_by' })
  decidedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'decided_at' })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer?: AppUser;

  @ManyToOne(() => AppUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'decided_by' })
  decider?: AppUser | null;
}
