import { AuditWithTimezone } from '@shared/models/audit.model';
import { UserStatus } from '@storage/types';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('app_users')
export class AppUser extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string;

  @Column({ length: 150, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'password_hash', select: false })
  passwordHash?: string;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'oauth_provider' })
  oauthProvider?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'oauth_subject' })
  oauthSubject?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'email_verified_at' })
  emailVerifiedAt?: Date;

  @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
  status: UserStatus;
}
