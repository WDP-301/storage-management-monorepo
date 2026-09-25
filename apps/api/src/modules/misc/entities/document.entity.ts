import { Contract } from '@modules/contracts/entities/contract.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { DocumentType } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'owner_user_id' })
  ownerUserId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'contract_id' })
  contractId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @Column({ type: 'varchar', length: 30 })
  type: DocumentType;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'doc_number' })
  docNumber?: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 1000, name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'uuid', nullable: true, name: 'uploaded_by' })
  uploadedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true, select: false })
  deletedAt?: Date;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  owner?: AppUser;

  @ManyToOne(() => Contract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;

  @ManyToOne(() => Facility, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: AppUser;
}
