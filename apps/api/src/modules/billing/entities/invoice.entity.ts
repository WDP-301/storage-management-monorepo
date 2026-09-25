import { Contract } from '@modules/contracts/entities/contract.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { InvoiceStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40, name: 'invoice_no' })
  invoiceNo: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'uuid', nullable: true, name: 'contract_id' })
  contractId?: string;

  @Column({ type: 'varchar', length: 20, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'char', length: 3, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'due_at' })
  dueAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'issued_at' })
  issuedAt?: Date;

  @Column({ type: 'jsonb', default: () => "'{}'", name: 'billing_info' })
  billingInfo: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;

  @ManyToOne(() => Contract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;
}
