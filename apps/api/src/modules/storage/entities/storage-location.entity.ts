import { AuditWithTimezone } from '@shared/models/audit.model';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { StorageItem } from './storage-item.entity';

@Entity('storage_locations')
export class StorageLocation extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @Column({ type: 'int', nullable: true, default: 1000 })
  capacity?: number;

  @OneToMany(
    () => StorageItem,
    (item) => item.location,
  )
  items: StorageItem[];
}
