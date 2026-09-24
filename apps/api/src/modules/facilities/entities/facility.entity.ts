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

  @Column({ type: 'varchar', length: 100, nullable: true })
  ward?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district?: string;

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  longitude: number;

  @Column({ type: 'varchar', length: 20, default: FacilityStatus.ACTIVE })
  status: FacilityStatus;
}
