import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import type { RefundBankAccount, ReturnRequestSource, ReturnRules } from '@storage/types';
import { InspectionType } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'varchar', length: 20 })
  type: InspectionType;

  @Column({ type: 'uuid', nullable: true, name: 'inspected_by' })
  inspectedBy?: string;

  @Column({ type: 'text', nullable: true, name: 'condition_notes' })
  conditionNotes?: string | null;

  /** What the customer asked for when requesting a return; the inspector never edits it. */
  @Column({ type: 'text', nullable: true, name: 'request_note' })
  requestNote?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence: any[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  damages: any[];

  /** Appointment for the handover/return visit, so staff can plan their schedule. */
  @Column({ type: 'timestamptz', nullable: true, name: 'scheduled_at' })
  scheduledAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'inspected_at' })
  inspectedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'finalized_at' })
  finalizedAt?: Date;

  /** RETURN: since when the notice runs; reset to the change time when the return is brought forward. */
  @Column({ type: 'timestamptz', nullable: true, name: 'notice_from' })
  noticeFrom?: Date | null;

  /** RETURN: Vietnam calendar day (YYYY-MM-DD) the unit was actually handed back. */
  @Column({ type: 'date', nullable: true, name: 'returned_on' })
  returnedOn?: string | null;

  /** RETURN: refund account the customer gave, frozen once the return is finalized. */
  @Column({ type: 'jsonb', nullable: true, name: 'refund_account' })
  refundAccount?: RefundBankAccount | null;

  /** RETURN: notice and overstay rules in force when the request was made. */
  @Column({ type: 'jsonb', nullable: true, name: 'return_rules' })
  returnRules?: ReturnRules | null;

  /** RETURN: who created the request — the customer, or branch staff on their behalf. */
  @Column({ type: 'uuid', nullable: true, name: 'requested_by' })
  requestedBy?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'request_source' })
  requestSource?: ReturnRequestSource | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inspected_by' })
  inspector?: AppUser;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by' })
  requester?: AppUser;
}
