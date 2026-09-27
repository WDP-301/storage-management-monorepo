import { InvoiceItem } from '@modules/billing/entities/invoice-item.entity';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { DamageFeeStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Inspection } from './inspection.entity';

@Entity('damage_fees')
export class DamageFee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'inspection_id' })
  inspectionId: string;

  @Column({ type: 'uuid', nullable: true, name: 'invoice_item_id' })
  invoiceItemId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'confirmed_by' })
  confirmedBy?: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence: any[];

  @Column({ type: 'varchar', length: 20, default: DamageFeeStatus.PROPOSED })
  status: DamageFeeStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Inspection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspection_id' })
  inspection: Inspection;

  @ManyToOne(() => InvoiceItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItem?: InvoiceItem;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by' })
  confirmer?: AppUser;
}
