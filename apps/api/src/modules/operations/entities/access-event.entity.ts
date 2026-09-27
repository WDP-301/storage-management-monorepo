import { ContractUnit } from '@modules/contracts/entities/contract-unit.entity';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { AccessEventType } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('access_events')
export class AccessEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_unit_id' })
  contractUnitId: string;

  @Column({ type: 'varchar', length: 20, name: 'event_type' })
  eventType: AccessEventType;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, name: 'qr_token_hash' })
  qrTokenHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'used_at' })
  usedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'verified_by' })
  verifiedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ContractUnit)
  @JoinColumn({ name: 'contract_unit_id' })
  contractUnit: ContractUnit;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verified_by' })
  verifier?: AppUser;
}
