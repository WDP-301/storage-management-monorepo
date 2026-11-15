import { Contract } from '@entities/contract.entity';
import { ShelfItemUnit } from '@storage/types';
import {
  Check,
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
 * One kind of goods a customer keeps on a shelf, with how many are there now. Stock belongs to
 * the contract rather than a stored shelf: a unit change moves the contract to another shelf and
 * the goods go with it. A row stays at quantity 0 once emptied so receipt lines keep pointing at it.
 * `unit` is set when the item is created and never changes; a top-up in another unit is refused.
 */
@Entity('shelf_items')
@Check('CK_shelf_items_quantity', `"quantity" >= 0`)
// Case-insensitive name per contract is an expression index, created in the migration.
@Index('UQ_shelf_items_contract_name', { synchronize: false })
export class ShelfItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'varchar', length: 10, default: ShelfItemUnit.PACKAGE })
  unit: ShelfItemUnit;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Contract, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;
}
