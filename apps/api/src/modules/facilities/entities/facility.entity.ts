import { AuditWithTimezone } from '@shared/models/audit.model';
import { FacilityStatus } from '@storage/types';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('facilities')
export class Facility extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 255, name: 'address_line' })
  addressLine: string;

  /** Ward code — FK → wards.code (VN post-2025 two-level model) */
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'ward_code' })
  wardCode?: string;

  /** Province code — FK → provinces.code */
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'province_code' })
  provinceCode?: string;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  longitude: number;

  @Column({ type: 'varchar', length: 20, default: FacilityStatus.ACTIVE })
  status: FacilityStatus;
}
