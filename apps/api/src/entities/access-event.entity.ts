import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
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

/**
 * A row is a check-in pass: inserted when the customer generates the QR, `usedAt` set when staff
 * scan it. The unit/facility are snapshots, since a change request may later move the contract.
 */
@Entity('access_events')
@Index('IDX_access_events_contract', ['contractId'])
// DESC ordering is not expressible in the decorator, so the migration owns the real definition.
@Index('IDX_access_events_facility_used', { synchronize: false })
export class AccessEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'uuid', name: 'storage_unit_id' })
  storageUnitId: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

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

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => StorageUnit)
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit: StorageUnit;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verified_by' })
  verifier?: AppUser;
}
