import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * An item a warehouse can be equipped with (air conditioning, shelving, CCTV…), managed by admins.
 * `code` never changes once created: it is the stable handle for seeds and integrations, while
 * `name` is free to be reworded. Retiring an amenity (`isActive = false`) drops it from the public
 * catalog (pickers, filter choices) but keeps it on the warehouses already equipped with it.
 */
@Entity('amenities')
// A unique constraint, not an index, to match the migration so schema diffs stay empty.
@Unique('UQ_amenities_code', ['code'])
export class Amenity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_amenities' })
  id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
