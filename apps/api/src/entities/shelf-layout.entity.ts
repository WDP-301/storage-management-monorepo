import type { LayoutElementType } from '@storage/types';
import { Check, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** A rectangle of grid cells, 0-based from the top-left. */
export interface LayoutRect {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

/** A non-shelf item on the floor plan; `text` is required for a LABEL. */
export interface LayoutElement extends LayoutRect {
  type: LayoutElementType;
  text?: string;
}

/** Where a shelf stands. Shelves are referenced by id, not by FK, so a deleted shelf can linger here. */
export interface ShelfPlacement extends LayoutRect {
  shelfId: string;
}

/**
 * The floor plan of a shelf warehouse (primary key = the warehouse). `elements` and `placements`
 * are replaced as one document; `version` counts saves and guards concurrent editors.
 */
@Entity('shelf_layouts')
@Check('CK_shelf_layouts_rows', '"rows" BETWEEN 1 AND 100')
@Check('CK_shelf_layouts_cols', '"cols" BETWEEN 1 AND 100')
export class ShelfLayout {
  @PrimaryColumn({
    type: 'uuid',
    name: 'warehouse_id',
    primaryKeyConstraintName: 'PK_shelf_layouts',
  })
  warehouseId: string;

  @Column({ type: 'smallint' })
  rows: number;

  @Column({ type: 'smallint' })
  cols: number;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  elements: LayoutElement[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  placements: ShelfPlacement[];

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
