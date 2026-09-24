import { AppUser } from '@modules/users/entities/app-user.entity';
import { NotificationChannel, NotificationStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 15 })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, any>;

  @Column({ type: 'varchar', length: 15, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'sent_at' })
  sentAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: AppUser;
}
