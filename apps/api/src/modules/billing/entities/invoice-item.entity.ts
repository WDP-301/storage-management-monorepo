import { RentalPeriod } from '@modules/contracts/entities/rental-period.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { InvoiceItemType } from '@shared/models/domain.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'invoice_id' })
  invoiceId: string;

  @Column({ type: 'uuid', nullable: true, name: 'storage_unit_id' })
  storageUnitId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'rental_period_id' })
  rentalPeriodId?: string;

  @Column({ type: 'varchar', length: 25, name: 'item_type' })
  itemType: InvoiceItemType;

  @Column({ length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'unit_amount' })
  unitAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => StorageUnit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit?: StorageUnit;

  @ManyToOne(() => RentalPeriod, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rental_period_id' })
  rentalPeriod?: RentalPeriod;
}
