import { AppUser } from '@entities/app-user.entity';
import type { SettingValueType } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryColumn({ length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'varchar', length: 20, name: 'value_type' })
  valueType: SettingValueType;

  @Column({ type: 'varchar', length: 50 })
  group: string;

  @Column({ type: 'text', nullable: true })
  label?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'default_value' })
  defaultValue?: unknown;

  @Column({ type: 'double precision', nullable: true })
  min?: number;

  @Column({ type: 'double precision', nullable: true })
  max?: number;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater?: AppUser;
}
