import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { ContractUnitStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';

@Entity('contract_units')
export class ContractUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'uuid', name: 'storage_unit_id' })
  storageUnitId: string;

  @Column({ type: 'timestamptz', name: 'start_at' })
  startAt: Date;

  @Column({ type: 'timestamptz', name: 'end_at' })
  endAt: Date;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'monthly_price_snapshot' })
  monthlyPriceSnapshot: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'deposit_snapshot' })
  depositSnapshot: number;

  @Column({ type: 'varchar', length: 20, default: ContractUnitStatus.PENDING })
  status: ContractUnitStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => StorageUnit)
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit: StorageUnit;
}
