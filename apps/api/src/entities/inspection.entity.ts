import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { InspectionType } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_id' })
  contractId: string;

  @Column({ type: 'varchar', length: 20 })
  type: InspectionType;

  @Column({ type: 'uuid', nullable: true, name: 'inspected_by' })
  inspectedBy?: string;

  @Column({ type: 'text', nullable: true, name: 'condition_notes' })
  conditionNotes?: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence: any[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  damages: any[];

  @Column({ type: 'timestamptz', nullable: true, name: 'inspected_at' })
  inspectedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'finalized_at' })
  finalizedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inspected_by' })
  inspector?: AppUser;
}
