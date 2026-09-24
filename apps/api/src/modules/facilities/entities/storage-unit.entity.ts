import { AuditWithTimezone } from '@shared/models/audit.model';
import { StorageUnitStatus } from '@storage/types';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Facility } from './facility.entity';
import { UnitType } from './unit-type.entity';

@Entity('storage_units')
@Unique('UQ_units_facility_code', ['facilityId', 'code'])
export class StorageUnit extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', name: 'unit_type_id' })
  unitTypeId: string;

  @Column({ length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  zone?: string;

  @Column({ type: 'decimal', precision: 9, scale: 2, nullable: true, name: 'pos_x' })
  posX?: number;

  @Column({ type: 'decimal', precision: 9, scale: 2, nullable: true, name: 'pos_y' })
  posY?: number;

  @Column({ type: 'decimal', precision: 9, scale: 2, name: 'area_m2' })
  areaM2: number;

  @Column({ type: 'varchar', length: 25, default: StorageUnitStatus.AVAILABLE })
  status: StorageUnitStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => UnitType)
  @JoinColumn({ name: 'unit_type_id' })
  unitType: UnitType;
}
