import { AuditWithTimezone } from '@shared/models/audit.model';
import { FacilityStatus } from '@storage/types';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A branch that owns many warehouses (storage units); it carries identity and status only. */
@Entity('facilities')
export class Facility extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

  /** Optional region (province code, FK → provinces.code); informational only. */
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'province_code' })
  provinceCode?: string;

  @Column({ type: 'varchar', length: 20, default: FacilityStatus.ACTIVE })
  status: FacilityStatus;
}
