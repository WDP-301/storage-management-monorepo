import { AuditWithTimezone } from '@shared/models/audit.model';
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { AppUser } from './app-user.entity';

@Entity('customer_profiles')
export class CustomerProfile extends AuditWithTimezone {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ length: 255, nullable: true, name: 'address_line' })
  addressLine?: string;

  /** Ward code — FK → wards.code (VN post-2025 two-level model) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  ward?: string;

  /** Province code — FK → provinces.code */
  @Column({ type: 'varchar', length: 100, nullable: true })
  province?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'company_name' })
  companyName?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'tax_code' })
  taxCode?: string;

  @OneToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: AppUser;
}
