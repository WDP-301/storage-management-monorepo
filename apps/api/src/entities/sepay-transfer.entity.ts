import { SepayTransferOutcome } from '@storage/types';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One inbound SePay webhook delivery, persisted before any matching runs. This is the audit log
 * of "money that arrived": every transfer lands here, and the outcome column is the
 * reconciliation queue — transfers stuck at RECEIVED/UNMATCHED/AMBIGUOUS/LATE/NEEDS_REVIEW are
 * real money nobody has explained yet, listed for ops to assign by hand.
 */
@Entity('sepay_transfers')
@Index('IDX_sepay_transfers_outcome', ['outcome'])
export class SepayTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SePay's own transaction id — the webhook-level idempotency key. */
  @Column({ unique: true, length: 40, name: 'sepay_id' })
  sepayId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  /** Transfer content exactly as the bank sent it — booking/invoice numbers are parsed from this. */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'reference_code' })
  referenceCode: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  gateway: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'transaction_date' })
  transactionDate: Date | null;

  @Column({ type: 'varchar', length: 25, default: SepayTransferOutcome.RECEIVED })
  outcome: SepayTransferOutcome;

  /** The booking a staff member (or the matcher) attached this transfer to. */
  @Column({ type: 'uuid', nullable: true, name: 'booking_id' })
  bookingId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'invoice_id' })
  invoiceId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'resolved_by' })
  resolvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'resolution_note' })
  resolutionNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
