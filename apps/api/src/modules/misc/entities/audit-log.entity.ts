import { AppUser } from '@modules/customer/entities/app-user.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'actor_user_id' })
  actorUserId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ type: 'varchar', length: 80, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', nullable: true, name: 'entity_id' })
  entityId?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'before_data' })
  beforeData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'after_data' })
  afterData?: Record<string, any>;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor?: AppUser;

  @ManyToOne(() => Facility, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;
}
