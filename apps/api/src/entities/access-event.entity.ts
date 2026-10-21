import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { AccessEventType } from '@storage/types';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A row is a check-in pass: inserted when the customer's app shows the QR; `usedAt` and the warehouse
 * are set when staff scan it. Passes belong to the customer; `contractId` and
 * `storageUnitId` are only set on entries made when passes were still issued per shelf contract.
 */
@Entity('access_events')
@Index('IDX_access_events_contract', ['contractId'])
@Index('IDX_access_events_customer', ['customerId'])
@Check(
  'CK_access_events_used_place',
  `"used_at" IS NULL OR ("warehouse_id" IS NOT NULL AND "facility_id" IS NOT NULL)`,
)
// DESC ordering is not expressible in the decorator, so the migration owns the real definition.
@Index('IDX_access_events_facility_used', { synchronize: false })
export class AccessEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  /** Set on scan. */
  @Column({ type: 'uuid', nullable: true, name: 'warehouse_id' })
  warehouseId: string | null;

  /** Set on scan: the facility of `warehouseId`. */
  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'contract_id' })
  contractId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'storage_unit_id' })
  storageUnitId: string | null;

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

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;

  @ManyToOne(() => StorageUnit, { nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: StorageUnit | null;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility | null;

  @ManyToOne(() => Contract, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract | null;

  @ManyToOne(() => StorageUnit, { nullable: true })
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit?: StorageUnit | null;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verified_by' })
  verifier?: AppUser;
}
