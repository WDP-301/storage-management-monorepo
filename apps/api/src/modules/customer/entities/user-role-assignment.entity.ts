import { UserRole } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Facility } from '../../facilities/entities/facility.entity';
import { AppUser } from './app-user.entity';

@Entity('user_role_assignments')
export class UserRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_by' })
  assignedBy?: string;

  @Column({ type: 'timestamptz', name: 'starts_at', default: () => 'now()' })
  startsAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'ends_at' })
  endsAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by' })
  assigner?: AppUser;
}
