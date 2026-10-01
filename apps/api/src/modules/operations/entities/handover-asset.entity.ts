import { Contract } from '@modules/contracts/entities/contract.entity';
import { AppUser } from '@modules/customer/entities/app-user.entity';
import { AssetType, HandoverDirection } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('handover_assets')
export class HandoverAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'varchar', length: 15 })
  direction: HandoverDirection;

  @Column({ type: 'varchar', length: 30, name: 'asset_type' })
  assetType: AssetType;

  @Column({ type: 'varchar', length: 1000, name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'uuid', nullable: true, name: 'uploaded_by' })
  uploadedBy?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: AppUser;
}
