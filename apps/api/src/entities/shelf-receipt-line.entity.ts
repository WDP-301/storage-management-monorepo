import { ShelfItem } from '@entities/shelf-item.entity';
import { ShelfReceipt } from '@entities/shelf-receipt.entity';
import { ShelfItemUnit } from '@storage/types';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

/** One item and quantity on a receipt; `name` and `unit` are the item's when the receipt was saved. */
@Entity('shelf_receipt_lines')
@Index('UQ_shelf_receipt_lines_item', ['receiptId', 'itemId'], { unique: true })
@Index('IDX_shelf_receipt_lines_item', ['itemId'])
export class ShelfReceiptLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'receipt_id' })
  receiptId: string;

  @Column({ type: 'uuid', name: 'item_id' })
  itemId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 10, default: ShelfItemUnit.PACKAGE })
  unit: ShelfItemUnit;

  @ManyToOne(
    () => ShelfReceipt,
    (receipt) => receipt.lines,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'receipt_id' })
  receipt: ShelfReceipt;

  @ManyToOne(() => ShelfItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: ShelfItem;
}
