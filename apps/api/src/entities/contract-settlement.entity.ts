import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import type {
  EvidenceFile,
  RefundBankAccount,
  SettlementLine,
  SettlementStatus,
} from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Deposit } from './deposit.entity';
import { Invoice } from './invoice.entity';

/**
 * The approved deposit settlement of an ended contract — the only record of it. Lines and
 * totals are frozen at approval; the refund itself is a manual bank transfer confirmed later.
 */
@Entity('contract_settlements')
// Partial unique index (transfer_ref IS NOT NULL) — created by migration;
// metadata kept sync-off so schema sync never manages the WHERE clause.
@Index('UQ_contract_settlements_transfer_ref', { synchronize: false })
export class ContractSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'contract_id' })
  contractId: string;

  @Column({ type: 'uuid', name: 'deposit_id' })
  depositId: string;

  @Column({ type: 'varchar', length: 20 })
  status: SettlementStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  lines: SettlementLine[];

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'deposit_amount' })
  depositAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'credits_total' })
  creditsTotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'deductions_total' })
  deductionsTotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'refund_amount' })
  refundAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'shortfall_amount' })
  shortfallAmount: number;

  /** Invoice for what the deposit did not cover; null when there was no shortfall. */
  @Column({ type: 'uuid', nullable: true, name: 'fee_invoice_id' })
  feeInvoiceId?: string | null;

  /** Account the customer gave with the return request, as it was at approval. */
  @Column({ type: 'jsonb', nullable: true, name: 'customer_bank_account' })
  customerBankAccount?: RefundBankAccount | null;

  /** Account the refund is sent to. */
  @Column({ type: 'jsonb', nullable: true, name: 'bank_account' })
  bankAccount?: RefundBankAccount | null;

  /** Who replaced the customer's account; a reason is then mandatory (DB check). */
  @Column({ type: 'uuid', nullable: true, name: 'bank_override_by' })
  bankOverrideBy?: string | null;

  @Column({ type: 'text', nullable: true, name: 'bank_override_reason' })
  bankOverrideReason?: string | null;

  /** Bank reference of the refund transfer; unique when present. */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'transfer_ref' })
  transferRef?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence: EvidenceFile[];

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy?: string | null;

  @Column({ type: 'timestamptz', name: 'approved_at' })
  approvedAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'completed_by' })
  completedBy?: string | null;

  /** Set exactly when the status is COMPLETED (DB check). */
  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => Deposit)
  @JoinColumn({ name: 'deposit_id' })
  deposit: Deposit;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fee_invoice_id' })
  feeInvoice?: Invoice | null;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bank_override_by' })
  bankOverrider?: AppUser | null;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver?: AppUser | null;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completed_by' })
  completer?: AppUser | null;
}
