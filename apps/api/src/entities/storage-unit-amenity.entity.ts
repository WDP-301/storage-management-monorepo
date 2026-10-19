import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Amenity } from './amenity.entity';
import { StorageUnit } from './storage-unit.entity';

/**
 * One amenity installed in one warehouse, with how many and an optional remark. The composite key
 * serves both the "has all of these amenities" filter and the batched load per warehouse.
 */
@Entity('storage_unit_amenities')
@Check('CK_storage_unit_amenities_quantity', '"quantity" BETWEEN 1 AND 99')
export class StorageUnitAmenity {
  @PrimaryColumn({
    type: 'uuid',
    name: 'storage_unit_id',
    primaryKeyConstraintName: 'PK_storage_unit_amenities',
  })
  storageUnitId: string;

  @PrimaryColumn({
    type: 'uuid',
    name: 'amenity_id',
    primaryKeyConstraintName: 'PK_storage_unit_amenities',
  })
  amenityId: string;

  @Column({ type: 'smallint', default: 1 })
  quantity: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  // Declared so schema tooling keeps the migration's foreign keys instead of dropping them.
  @ManyToOne(() => StorageUnit, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'storage_unit_id',
    foreignKeyConstraintName: 'FK_storage_unit_amenities_unit',
  })
  storageUnit?: StorageUnit;

  // RESTRICT: amenities are retired, never deleted, so a warehouse never loses one silently.
  @ManyToOne(() => Amenity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'amenity_id', foreignKeyConstraintName: 'FK_storage_unit_amenities_amenity' })
  amenity?: Amenity;
}
