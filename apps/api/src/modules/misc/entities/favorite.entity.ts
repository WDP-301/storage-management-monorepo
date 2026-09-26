import { AppUser } from '@modules/customer/entities/app-user.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'storage_unit_id' })
  storageUnitId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;

  @ManyToOne(() => Facility, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;

  @ManyToOne(() => StorageUnit, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit?: StorageUnit;
}
