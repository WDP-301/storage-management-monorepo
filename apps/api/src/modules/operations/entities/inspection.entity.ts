import { ContractUnit } from '@modules/contracts/entities/contract-unit.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { InspectionStatus, InspectionType } from '@shared/models/domain.enums';
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

  @Column({ type: 'uuid', name: 'contract_unit_id' })
  contractUnitId: string;

  @Column({ type: 'varchar', length: 20 })
  type: InspectionType;

  @Column({ type: 'varchar', length: 20, default: InspectionStatus.PENDING })
  status: InspectionStatus;

  @Column({ type: 'uuid', nullable: true, name: 'inspected_by' })
  inspectedBy?: string;

  @Column({ type: 'text', nullable: true, name: 'condition_notes' })
  conditionNotes?: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence: any[];

  @Column({ type: 'timestamptz', nullable: true, name: 'inspected_at' })
  inspectedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ContractUnit)
  @JoinColumn({ name: 'contract_unit_id' })
  contractUnit: ContractUnit;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inspected_by' })
  inspector?: AppUser;
}
